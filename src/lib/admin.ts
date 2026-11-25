/** What only admins do on the portal: users, stages and connection checks. */
import { brevoAccount } from "./brevo";
import { geminiCheck } from "./gemini";
import { driveName, driveReady } from "./google";
import { driveTarget } from "./settings";
import { ApiError, auth } from "./supabase";
import { audit, type User } from "./user";

export type Account = { id: string; email: string; full_name: string | null; user_type: "admin" | "consultant"; active: boolean; created_at: string };

function admin(user: User) {
  if (!user.isAdmin) throw new ApiError("Only an admin can do that.", 403);
}

export async function listUsers(user: User): Promise<Account[]> {
  admin(user);
  return user.db.select<Account>("profiles", { select: "id,email,full_name,user_type,active,created_at", order: "created_at.asc" });
}

export async function updateUser(user: User, id: string, change: { active?: boolean; user_type?: string }): Promise<void> {
  admin(user);
  if (id === user.uid && (change.active === false || change.user_type === "consultant")) {
    throw new ApiError("You cannot switch off or demote your own account.");
  }
  const values: Record<string, unknown> = {};
  if (typeof change.active === "boolean") values.active = change.active;
  if (change.user_type === "admin" || change.user_type === "consultant") values.user_type = change.user_type;
  if (!Object.keys(values).length) return;
  await user.db.update("profiles", values, { id: `eq.${id}` });
  await audit(user, "user_changed", { user: id, ...values });
}

export async function createUser(user: User, email: string, name: string, password: string, switchOn: boolean): Promise<string> {
  admin(user);
  email = email.trim().toLowerCase(); name = name.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError("That is not an email address.");
  if (!name) throw new ApiError("Enter the person's name.");
  if (password.length < 8) throw new ApiError("Use a password of at least 8 characters.");
  const out = await auth.signUp(email, password, name);
  const id = out.user?.id || out.id || "";
  await audit(user, "user_created", { email, name });
  if (switchOn) {
    const row = (await user.db.select<{ id: string }>("profiles", { email: `eq.${email}`, select: "id" }))[0];
    if (row) await user.db.update("profiles", { active: true }, { id: `eq.${row.id}` });
    else return "The account was created. It appears in the list once the person confirms their email; switch it on then.";
  }
  return out.access_token || id ? `${name} can sign in now${switchOn ? "" : " once you switch the account on"}.`
    : `${name} was sent a confirmation email and can sign in after opening it${switchOn ? "" : " and being switched on"}.`;
}

export type StageEdit = { id?: string; name: string; color: string };

/** Save the stages in the order given. Stages left out are deleted; their candidates stay in the role without a stage. */
export async function saveStages(user: User, list: StageEdit[]): Promise<void> {
  admin(user);
  const clean = list.map((s) => ({ id: s.id && /^[0-9a-f-]{36}$/i.test(s.id) ? s.id : undefined, name: s.name.trim().slice(0, 40),
                                   color: /^#[0-9a-f]{6}$/i.test(s.color) ? s.color.toUpperCase() : "#6B6660" }));
  if (!clean.length) throw new ApiError("Keep at least one stage.");
  if (clean.some((s) => !s.name)) throw new ApiError("Give every stage a name, or remove the empty one.");
  if (new Set(clean.map((s) => s.name.toLowerCase())).size !== clean.length) throw new ApiError("Two stages have the same name.");
  const existing = await user.db.select<{ id: string }>("stages", { select: "id" });
  const keep = new Set(clean.map((s) => s.id).filter(Boolean));
  for (const old of existing) if (!keep.has(old.id)) await user.db.remove("stages", { id: `eq.${old.id}` });
  let order = 0;
  for (const s of clean) {
    order += 10;
    if (s.id) await user.db.update("stages", { name: s.name, color: s.color, sort_order: order }, { id: `eq.${s.id}` });
    else await user.db.insert("stages", [{ name: s.name, color: s.color, sort_order: order }], { returning: false });
  }
  await audit(user, "stages_changed", { stages: clean.map((s) => s.name) });
}

export async function checkConnection(user: User, kind: string): Promise<string> {
  admin(user);
  if (kind === "gemini") return geminiCheck(user.db);
  if (kind === "drive") {
    if (!driveReady()) throw new Error("The Google service account key is not set on the host.");
    const where = await driveTarget(user);
    if (!where.id) throw new Error("No shared drive ID is set. Add it in the desktop app's Settings, or as GOOGLE_DRIVE_ID on the host.");
    return `Connected to the shared drive "${await driveName(where.id)}".`;
  }
  if (kind === "brevo") return brevoAccount(user);
  throw new Error("Unknown check.");
}
