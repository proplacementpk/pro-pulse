"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_DAYS, setupProblem } from "@/lib/config";
import { blockedFor, cleared, failed } from "@/lib/ratelimit";
import { cookieOptions, expiry, seal, unseal } from "@/lib/session";
import { ApiError, auth, db } from "@/lib/supabase";

export type LoginState = { error?: string; email?: string };

/** Only addresses inside this portal are followed after signing in. */
function safeNext(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/login") ? value : "/search";
}

export async function signIn(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const next = safeNext(String(form.get("next") || ""));
  const problem = setupProblem();
  if (problem) return { error: problem, email };
  if (!email || !password) return { error: "Enter your email and password.", email };

  const h = await headers();
  const from = (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "local";
  const key = `${from}|${email}`;
  const wait = blockedFor(key);
  if (wait) return { error: `Too many wrong tries. Wait ${wait} minute${wait === 1 ? "" : "s"} and try again.`, email };

  let tokens;
  try {
    tokens = await auth.signIn(email, password);
  } catch (e) {
    if (e instanceof ApiError && e.status < 500) {
      failed(key);
      const confirm = /not confirmed/i.test(e.message);
      return { error: confirm ? "Confirm your email first: open the link Supabase sent you." : "The email or password is not right.", email };
    }
    return { error: e instanceof Error ? e.message : "Could not sign in. Try again.", email };
  }
  const uid = tokens.user?.id || "";
  const client = db(tokens.access_token);
  let profile: { full_name: string | null; email: string; active: boolean } | undefined;
  try {
    profile = (await client.select("profiles", { id: `eq.${uid}`, select: "full_name,email,active" }))[0];
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not sign in. Try again.", email };
  }
  if (!profile || !profile.active) {
    await auth.signOut(tokens.access_token);
    return { error: "Your account is waiting for an admin to switch it on.", email };
  }
  cleared(key);
  (await cookies()).set(SESSION_COOKIE,
    await seal({ access: tokens.access_token, refresh: tokens.refresh_token, expires: expiry(tokens.expires_in), uid }),
    cookieOptions(SESSION_DAYS));
  try {
    await client.insert("audit_log", [{ user_id: uid, user_name: profile.full_name || profile.email, action: "signed_in",
                                        detail: { how: "password", via: "web" } }], { returning: false });
  } catch { /* the log never blocks signing in */ }
  redirect(next);
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const session = await unseal(jar.get(SESSION_COOKIE)?.value);
  if (session) {
    try {
      await db(session.access).insert("audit_log", [{ user_id: session.uid, action: "signed_out", detail: { via: "web" } }], { returning: false });
    } catch { /* ignore */ }
    await auth.signOut(session.access);
  }
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
