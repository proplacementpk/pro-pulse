"use server";
import { revalidatePath } from "next/cache";
import { addToRole, searchIds } from "@/lib/data";
import { readFilters, type Raw } from "@/lib/search";
import { currentUser } from "@/lib/user";

export type Result = { ok: boolean; message: string; ids?: string[] };

const fail = (e: unknown): Result => ({ ok: false, message: e instanceof Error ? e.message : "Something went wrong. Try again." });
const ENDED: Result = { ok: false, message: "Your sign-in has ended. Refresh the page and sign in again." };

export async function addToRoleAction(roleId: string, roleTitle: string, ids: string[]): Promise<Result> {
  const user = await currentUser();
  if (!user) return ENDED;
  if (!ids.length) return { ok: false, message: "Tick one or more candidates first." };
  if (!roleId) return { ok: false, message: "Choose a role first." };
  try {
    const added = await addToRole(user, roleId, ids.slice(0, 5000));
    const skipped = ids.length - added;
    revalidatePath("/search");
    return { ok: true, message: `Added ${added} to ${roleTitle}` + (skipped ? `, ${skipped} already there` : "") };
  } catch (e) {
    return fail(e);
  }
}

/** Every candidate the current search finds, on all pages. */
export async function selectAllAction(params: Raw): Promise<Result> {
  const user = await currentUser();
  if (!user) return ENDED;
  try {
    return { ok: true, message: "", ids: await searchIds(user, readFilters(params)) };
  } catch (e) {
    return fail(e);
  }
}
