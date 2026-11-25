"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addNote } from "@/lib/data";
import { deleteRole, removeFromRole, saveRole, setStage } from "@/lib/roles";
import { currentUser } from "@/lib/user";

export type Result = { ok: boolean; message: string };
export type State = { error?: string };

const fail = (e: unknown): Result => ({ ok: false, message: e instanceof Error ? e.message : "Something went wrong. Try again." });
const ENDED: Result = { ok: false, message: "Your sign-in has ended. Refresh the page and sign in again." };

export async function setStageAction(roleId: string, rcIds: string[], stageId: string, stageName: string): Promise<Result> {
  const user = await currentUser();
  if (!user) return ENDED;
  try {
    await setStage(user, rcIds, stageId);
    revalidatePath(`/roles/${roleId}`);
    return { ok: true, message: rcIds.length > 1 ? `${rcIds.length} moved to ${stageName}` : `Moved to ${stageName}` };
  } catch (e) { return fail(e); }
}

export async function removeAction(roleId: string, rcIds: string[]): Promise<Result> {
  const user = await currentUser();
  if (!user) return ENDED;
  try {
    await removeFromRole(user, rcIds);
    revalidatePath(`/roles/${roleId}`);
    return { ok: true, message: `Removed ${rcIds.length} from this role` };
  } catch (e) { return fail(e); }
}

export async function roleNoteAction(roleId: string, candidateId: string, body: string): Promise<Result> {
  const user = await currentUser();
  if (!user) return ENDED;
  try {
    await addNote(user, candidateId, body, roleId);
    revalidatePath(`/roles/${roleId}`);
    return { ok: true, message: "Note saved" };
  } catch (e) { return fail(e); }
}

export async function saveRoleAction(_prev: State, form: FormData): Promise<State> {
  const user = await currentUser();
  if (!user) return { error: ENDED.message };
  const id = String(form.get("id") || "") || null;
  const fields = Object.fromEntries(["title", "department", "location", "assigned_to", "status", "description"].map((k) => [k, String(form.get(k) || "")]));
  let saved: string;
  try {
    saved = await saveRole(user, fields, id);
  } catch (e) {
    return { error: fail(e).message };
  }
  revalidatePath("/roles");
  redirect(`/roles/${saved}`);
}

export async function deleteRoleAction(id: string): Promise<Result> {
  const user = await currentUser();
  if (!user) return ENDED;
  try {
    await deleteRole(user, id);
  } catch (e) { return fail(e); }
  revalidatePath("/roles");
  redirect("/roles?deleted=1");
}
