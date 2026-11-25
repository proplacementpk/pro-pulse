"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addNote, addToRole, deleteCandidate, markReviewed, saveCandidate } from "@/lib/data";
import { list } from "@/lib/format";
import { currentUser } from "@/lib/user";

export type State = { error?: string; ok?: string };

const message = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Try again.");
const ENDED: State = { error: "Your sign-in has ended. Refresh the page and sign in again." };

export async function addNoteAction(_prev: State, form: FormData): Promise<State> {
  const user = await currentUser();
  if (!user) return ENDED;
  const id = String(form.get("candidate") || "");
  try {
    await addNote(user, id, String(form.get("body") || ""));
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath(`/candidates/${id}`);
  return { ok: "Note saved" };
}

export async function addToRoleFromProfile(_prev: State, form: FormData): Promise<State> {
  const user = await currentUser();
  if (!user) return ENDED;
  const id = String(form.get("candidate") || ""), role = String(form.get("role") || "");
  if (!role) return { error: "Choose a role first." };
  try {
    const added = await addToRole(user, role, [id]);
    revalidatePath(`/candidates/${id}`);
    return { ok: added ? "Added to the role" : "Already in that role" };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function markReviewedAction(form: FormData): Promise<void> {
  const user = await currentUser();
  const id = String(form.get("candidate") || "");
  if (user && id) {
    await markReviewed(user, id);
    revalidatePath(`/candidates/${id}`);
  }
}

const TEXT = ["full_name", "email", "alternate_email", "phone", "alternate_phone", "city", "country", "linkedin_url",
              "current_title", "current_company", "highest_education", "current_salary", "expected_salary", "notice_period",
              "benefits", "candidate_status", "summary"];

export async function saveCandidateAction(_prev: State, form: FormData): Promise<State> {
  const user = await currentUser();
  if (!user) return ENDED;
  const id = String(form.get("candidate") || "");
  const fields: Record<string, unknown> = {};
  for (const k of TEXT) fields[k] = String(form.get(k) ?? "").trim();
  const exp = String(form.get("total_experience_years") ?? "").trim();
  if (exp && !(Number(exp) >= 0 && Number(exp) <= 60)) return { error: "Experience is a number of years between 0 and 60." };
  fields.total_experience_years = exp ? Number(exp) : null;
  fields.skills = list(String(form.get("skills") || "")).slice(0, 80);
  if (!fields.full_name) return { error: "A candidate needs a name." };
  try {
    await saveCandidate(user, id, fields);
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath(`/candidates/${id}`);
  redirect(`/candidates/${id}?saved=1`);
}

export async function deleteCandidateAction(id: string): Promise<State> {
  const user = await currentUser();
  if (!user) return ENDED;
  try {
    await deleteCandidate(user, id);
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/search");
  redirect("/search?deleted=1");
}
