"use server";
import { revalidatePath } from "next/cache";
import { checkConnection, createUser, saveStages, updateUser, type StageEdit } from "@/lib/admin";
import { currentUser } from "@/lib/user";

export type Result = { ok: boolean; message: string };

async function run(job: (user: NonNullable<Awaited<ReturnType<typeof currentUser>>>) => Promise<string>): Promise<Result> {
  const user = await currentUser();
  if (!user) return { ok: false, message: "Your sign-in has ended. Refresh the page and sign in again." };
  if (!user.isAdmin) return { ok: false, message: "Only an admin can do that." };
  try {
    return { ok: true, message: await job(user) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Something went wrong. Try again." };
  }
}

export async function updateUserAction(id: string, change: { active?: boolean; user_type?: string }): Promise<Result> {
  return run(async (user) => { await updateUser(user, id, change); revalidatePath("/admin"); return "Saved"; });
}

export async function createUserAction(_prev: Result, form: FormData): Promise<Result> {
  return run(async (user) => {
    const message = await createUser(user, String(form.get("email") || ""), String(form.get("name") || ""),
                                     String(form.get("password") || ""), form.get("on") === "1");
    revalidatePath("/admin");
    return message;
  });
}

export async function saveStagesAction(list: StageEdit[]): Promise<Result> {
  return run(async (user) => { await saveStages(user, list); revalidatePath("/admin"); return "Stages saved"; });
}

export async function checkAction(kind: string): Promise<Result> {
  return run((user) => checkConnection(user, kind));
}
