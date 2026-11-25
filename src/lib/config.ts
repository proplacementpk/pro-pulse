/** Settings read from the host's environment. Nothing here reaches the browser. */
export const SUPABASE_URL = (process.env.PROPULSE_SUPABASE_URL || "").replace(/\/+$/, "");
export const PUBLISHABLE_KEY = process.env.PROPULSE_PUBLISHABLE_KEY || "";
export const SESSION_SECRET = process.env.SESSION_SECRET || "";
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
export const GOOGLE_SERVICE_ACCOUNT = process.env.GOOGLE_SERVICE_ACCOUNT || "";
export const GOOGLE_DRIVE_ID = process.env.GOOGLE_DRIVE_ID || "";
export const BREVO_API_KEY = process.env.BREVO_API_KEY || "";

export const SESSION_COOKIE = "pp_session";
export const THEME_COOKIE = "pp_theme";
/** How long someone stays signed in without using the portal. */
export const SESSION_DAYS = 7;

/** What is missing before the portal can run at all, in words for the person setting it up. */
export function setupProblem(): string | null {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
    return "The portal is not connected to Supabase yet. Set PROPULSE_SUPABASE_URL and PROPULSE_PUBLISHABLE_KEY on the host.";
  }
  if (SESSION_SECRET.length < 32) {
    return "SESSION_SECRET is missing or shorter than 32 characters. Set a long random text on the host.";
  }
  return null;
}
