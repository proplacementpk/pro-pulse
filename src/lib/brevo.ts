/** Email through Brevo. The key stays on the server; the sender address is the one set in the desktop app. */
import { BREVO_API_KEY } from "./config";
import { settings } from "./settings";
import { ApiError } from "./supabase";
import type { User } from "./user";

const API = process.env.PROPULSE_BREVO_URL || "https://api.brevo.com/v3";

export const emailReady = () => Boolean(BREVO_API_KEY);

async function call(method: string, path: string, body?: object): Promise<any> {
  if (!BREVO_API_KEY) throw new ApiError("Email is not set up on the web portal yet. An admin adds the Brevo key on the host.", 503);
  let res: Response;
  try {
    res = await fetch(`${API}/${path}`, {
      method, cache: "no-store", signal: AbortSignal.timeout(60_000),
      headers: { "api-key": BREVO_API_KEY, accept: "application/json", "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Could not reach Brevo. Try again in a moment.", 503);
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (res.status === 401) throw new ApiError("Brevo rejected the API key. An admin checks it on the host.", 502);
  if (!res.ok) throw new ApiError(`Brevo could not send the email: ${data?.message || res.status}`, 502);
  return data;
}

async function sender(user: User): Promise<{ email: string; name: string }> {
  const s = await settings(user);
  const email = (s["brevo.sender_email"] || "").trim();
  if (!email) throw new ApiError("No sender address is set. An admin adds it in the desktop app: Settings, Connections, Email.", 503);
  return { email, name: (s["brevo.sender_name"] || "Propulse").trim() || "Propulse" };
}

export async function brevoAccount(user: User): Promise<string> {
  const data = await call("GET", "account");
  return `Connected to the Brevo account ${data?.email || ""}. Emails are sent from ${(await sender(user)).email}.`;
}

export function validEmails(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean)) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(part)) throw new ApiError(`"${part}" is not an email address.`);
    if (!out.some((o) => o.toLowerCase() === part.toLowerCase())) out.push(part);
  }
  return out;
}

export async function sendMail(user: User, to: string[], subject: string, html: string, attachment?: { name: string; data: Buffer }): Promise<void> {
  const body: Record<string, unknown> = { sender: await sender(user), to: to.map((email) => ({ email })), subject, htmlContent: html };
  if (attachment) body.attachment = [{ name: attachment.name, content: attachment.data.toString("base64") }];
  await call("POST", "smtp/email", body);
}
