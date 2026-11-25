/** Google Drive, reached with the firm's service account (the same one the desktop app uses). */
import { createSign } from "node:crypto";
import { GOOGLE_SERVICE_ACCOUNT } from "./config";

const TOKEN_URL = process.env.PROPULSE_GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
export const DRIVE_API = process.env.PROPULSE_DRIVE_API || "https://www.googleapis.com/drive/v3";
export const DRIVE_UPLOAD = process.env.PROPULSE_DRIVE_UPLOAD || "https://www.googleapis.com/upload/drive/v3";

let cached: { token: string; until: number } | null = null;

export const driveReady = () => Boolean(GOOGLE_SERVICE_ACCOUNT);

function account(): { client_email: string; private_key: string } {
  try {
    const a = JSON.parse(GOOGLE_SERVICE_ACCOUNT);
    if (a.client_email && a.private_key) return a;
  } catch { /* fall through */ }
  throw new Error("Google Drive is not set up on the web portal yet. An admin adds the service account key on the host.");
}

/** A short-lived Google access token for the service account. */
export async function googleToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.until - 60 > now) return cached.token;
  const a = account();
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${part({ alg: "RS256", typ: "JWT" })}.${part({
    iss: a.client_email, scope: "https://www.googleapis.com/auth/drive", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(a.private_key).toString("base64url");
  const res = await fetch(TOKEN_URL, {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(20_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  if (!res.ok) throw new Error("Google did not accept the service account key. Check it on the host.");
  const data = await res.json();
  cached = { token: data.access_token, until: now + Number(data.expires_in || 3600) };
  return cached.token;
}

/** A stored file's content, for opening a resume in the browser. */
export async function driveDownload(fileId: string): Promise<Response> {
  const res = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
    cache: "no-store", headers: { Authorization: `Bearer ${await googleToken()}` }, signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(res.status === 404 ? "The file is no longer in Google Drive." : "Google Drive did not return the file.");
  return res;
}

const FOLDER = "application/vnd.google-apps.folder";
const folders = new Map<string, string>();

async function drive(method: string, url: string, init: { body?: BodyInit; headers?: Record<string, string> } = {}): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { method, cache: "no-store", signal: AbortSignal.timeout(90_000), body: init.body,
                             headers: { Authorization: `Bearer ${await googleToken()}`, ...(init.headers || {}) } });
  } catch (e) {
    if (e instanceof Error && /service account|Google did not accept/.test(e.message)) throw e;
    throw new Error("Could not reach Google Drive.");
  }
  if (res.status === 404) throw new Error("Google Drive could not find the shared drive. Check the shared drive ID, and that the service account is a member of it.");
  if (res.status === 403) throw new Error("Google Drive refused access. The service account's email must be a Content manager of the shared drive.");
  if (!res.ok) throw new Error(`Google Drive error ${res.status}.`);
  return res.json();
}

async function folder(driveId: string, parent: string, name: string): Promise<string> {
  const key = `${parent}/${name}`;
  if (folders.has(key)) return folders.get(key)!;
  const q = `name = '${name}' and mimeType = '${FOLDER}' and '${parent}' in parents and trashed = false`;
  const found = await drive("GET", `${DRIVE_API}/files?` + new URLSearchParams({
    q, fields: "files(id)", supportsAllDrives: "true", includeItemsFromAllDrives: "true", corpora: "drive", driveId }));
  let id: string = found.files?.[0]?.id;
  if (!id) {
    id = (await drive("POST", `${DRIVE_API}/files?supportsAllDrives=true&fields=id`, {
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent] }) })).id;
  }
  folders.set(key, id);
  return id;
}

/** Store a file in the shared drive, in a year/month folder like the desktop app does. */
export async function driveUpload(driveId: string, layout: string, name: string, mime: string, data: Buffer): Promise<{ id: string; webViewLink?: string }> {
  let parent = driveId;
  if (layout !== "flat") {
    const now = new Date();
    parent = await folder(driveId, await folder(driveId, driveId, String(now.getFullYear())), String(now.getMonth() + 1).padStart(2, "0"));
  }
  const boundary = "propulse-" + Date.now().toString(36);
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [parent] })}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`),
    data, Buffer.from(`\r\n--${boundary}--`),
  ]);
  return drive("POST", `${DRIVE_UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`, {
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body });
}

/** The shared drive's name, as proof that the key and the drive ID work. */
export async function driveName(driveId: string): Promise<string> {
  return (await drive("GET", `${DRIVE_API}/drives/${encodeURIComponent(driveId)}?fields=id,name`)).name || "";
}
