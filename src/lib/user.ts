/** Who is signed in, for pages and actions. */
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "./config";
import { unseal } from "./session";
import { ApiError, db, type Db } from "./supabase";

export type Profile = { id: string; email: string; full_name: string | null; user_type: "admin" | "consultant"; active: boolean };
export type User = { token: string; uid: string; profile: Profile; isAdmin: boolean; name: string; db: Db };

/** The signed-in, switched-on user, or null. Looked up once per request. */
export const currentUser = cache(async (): Promise<User | null> => {
  const session = await unseal((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const client = db(session.access);
  let rows: Profile[];
  try {
    rows = await client.select<Profile>("profiles", { id: `eq.${session.uid}`, select: "id,email,full_name,user_type,active" });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return null;
    throw e;
  }
  const profile = rows[0];
  if (!profile || !profile.active) return null;
  return { token: session.access, uid: session.uid, profile, isAdmin: profile.user_type === "admin",
           name: profile.full_name || profile.email, db: client };
});

/** For pages: the user, or off to the sign-in screen. */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login?reason=ended");
  return user;
}

/** Write a line to the activity log (the same log the desktop app shows to admins). Never blocks or fails the action. */
export async function audit(user: User, action: string, detail: Record<string, unknown> = {}): Promise<void> {
  try {
    await user.db.insert("audit_log", [{ user_id: user.uid, user_name: user.name, action, detail: { ...detail, via: "web" } }], { returning: false });
  } catch { /* logging must never break what the person was doing */ }
}
