/** The sign-in cookie: the Supabase session, encrypted, readable only by this server. */
import { SESSION_SECRET } from "./config";

export type Session = {
  access: string;   // Supabase access token (short-lived)
  refresh: string;  // Supabase refresh token
  expires: number;  // when the access token ends, in seconds since 1970
  uid: string;
};

const enc = new TextEncoder();
const dec = new TextDecoder();
let keyPromise: Promise<CryptoKey> | null = null;

function key(): Promise<CryptoKey> {
  if (!keyPromise) {
    keyPromise = crypto.subtle.digest("SHA-256", enc.encode(SESSION_SECRET)).then((hash) =>
      crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]));
  }
  return keyPromise;
}

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
const unb64 = (text: string) => new Uint8Array(Buffer.from(text, "base64url"));

export async function seal(session: Session): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), enc.encode(JSON.stringify(session)));
  return `${b64(iv)}.${b64(new Uint8Array(data))}`;
}

export async function unseal(value: string | undefined | null): Promise<Session | null> {
  if (!value || !value.includes(".")) return null;
  try {
    const [iv, data] = value.split(".");
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await key(), unb64(data));
    const s = JSON.parse(dec.decode(plain)) as Session;
    return s && s.access && s.refresh && s.uid ? s : null;
  } catch {
    return null; // tampered with, or made with another secret
  }
}

export function cookieOptions(maxAgeDays: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production" && process.env.PROPULSE_INSECURE_COOKIE !== "1",
    path: "/",
    maxAge: maxAgeDays * 24 * 60 * 60,
  };
}

/** When a fresh access token ends, in seconds since 1970. (The override exists only so the
 *  renewal path can be tested without waiting an hour.) */
export function expiry(expiresIn: number | undefined): number {
  const seconds = Number(process.env.PROPULSE_TEST_TOKEN_SECONDS) || expiresIn || 3600;
  return Math.floor(Date.now() / 1000) + seconds;
}
