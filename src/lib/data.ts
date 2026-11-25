/** Reads and writes shared by pages and actions. */
import { cache } from "react";
import { embed, embeddingText } from "./gemini";
import { toArgs, type Filters } from "./search";
import { ApiError, inList } from "./supabase";
import { audit, type User } from "./user";

export type Stage = { id: string; name: string; color: string | null; sort_order: number };
export type Role = { id: string; title: string; department: string | null; location: string | null; status: string;
                     description: string | null; assigned_to: string | null; assigned_name: string | null; created_at: string };
export type Hit = {
  id: string; full_name: string; current_title: string | null; current_company: string | null; city: string | null;
  total_experience_years: number | null; highest_education: string | null; skills: string[] | null;
  review_status: string | null; candidate_status: string | null; notice_period: string | null;
  match: string; total_count: number; created_at: string;
};

export const stages = cache(async (user: User) =>
  user.db.select<Stage>("stages", { select: "id,name,color,sort_order", order: "sort_order.asc" }));

export const roles = cache(async (user: User) =>
  user.db.select<Role>("job_roles", { select: "id,title,department,location,status,description,assigned_to,assigned_name,created_at",
                                       order: "created_at.desc" }));

export async function search(user: User, f: Filters, log = true): Promise<{ rows: Hit[]; total: number; meaning: boolean }> {
  const vector = f.q ? await embed(user.db, f.q, { query: true }) : null;
  const rows = await user.db.rpc<Hit[]>("search_candidates", toArgs(f, vector)) || [];
  const total = rows.length ? Number(rows[0].total_count) : 0;
  if (log && f.page === 1) {
    const used = Object.fromEntries(Object.entries(f).filter(([k, v]) =>
      !["q", "sort", "size", "page", "skillsMode"].includes(k) && v !== "" && v !== null && !(Array.isArray(v) && !v.length)));
    await audit(user, "search", { q: f.q, filters: used, results: total });
  }
  return { rows, total, meaning: Boolean(vector) };
}

/** The ids of everything a search finds, across all pages (for "Select all" and exports). */
export async function searchIds(user: User, f: Filters, most = 5000): Promise<string[]> {
  const vector = f.q ? await embed(user.db, f.q, { query: true }) : null;
  const ids: string[] = [];
  for (let offset = 0; offset < most; offset += 500) {
    const rows = await user.db.rpc<Hit[]>("search_candidates", toArgs(f, vector, 500, offset)) || [];
    ids.push(...rows.map((r) => r.id));
    if (rows.length < 500) break;
  }
  return ids;
}

export const CANDIDATE_FIELDS = [
  "full_name", "email", "alternate_email", "phone", "alternate_phone", "city", "country", "address", "nationality",
  "date_of_birth", "gender", "linkedin_url", "portfolio_url", "current_title", "current_company",
  "total_experience_years", "industry", "functional_area", "seniority_level", "summary", "highest_education",
  "current_salary", "expected_salary", "notice_period", "willing_to_relocate", "preferred_locations",
  "candidate_status", "consent_given", "skills", "languages", "experience", "education", "certifications", "projects",
  "benefits", "review_status",
];
const CANDIDATE_COLS = ["id", ...CANDIDATE_FIELDS, "owner", "created_at", "updated_at"].join(",");

export type Candidate = Record<string, any> & {
  id: string; full_name: string;
  resumes: { id: string; original_file_name: string; drive_file_id: string | null; drive_link: string | null; file_type: string | null; file_size: number | null; uploaded_at: string }[];
  roles: { rc_id: string; role_id: string; stage_id: string | null; title: string }[];
  notes: { id: string; body: string; author_name: string | null; created_at: string; role_id: string | null }[];
};

export async function getCandidate(user: User, id: string, log = true): Promise<Candidate | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await user.db.select("candidates", { id: `eq.${id}`, select: CANDIDATE_COLS });
  if (!rows.length) return null;
  const c = rows[0] as Candidate;
  const [resumes, rcs, notes] = await Promise.all([
    user.db.select("resumes", { candidate_id: `eq.${id}`, order: "uploaded_at.desc",
                                select: "id,original_file_name,drive_file_id,drive_link,file_type,file_size,uploaded_at" }),
    user.db.select<{ id: string; role_id: string; stage_id: string | null }>("role_candidates", { candidate_id: `eq.${id}`, select: "id,role_id,stage_id" }),
    user.db.select("notes", { candidate_id: `eq.${id}`, order: "created_at.desc", select: "id,body,author_name,created_at,role_id" }),
  ]);
  const titles: Record<string, string> = {};
  if (rcs.length) {
    for (const r of await user.db.select<{ id: string; title: string }>("job_roles", { id: inList(rcs.map((x) => x.role_id)), select: "id,title" })) {
      titles[r.id] = r.title;
    }
  }
  c.resumes = resumes;
  c.roles = rcs.map((x) => ({ rc_id: x.id, role_id: x.role_id, stage_id: x.stage_id, title: titles[x.role_id] || "" }));
  c.notes = notes;
  if (log) await audit(user, "candidate_viewed", { candidate_id: id, name: c.full_name });
  return c;
}

/** Keep only real candidate fields, with empty text as "not known" and lists never null. */
function cleanFields(fields: Record<string, unknown>): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const k of [...CANDIDATE_FIELDS, "resume_text"]) {
    if (k in fields) values[k] = fields[k] === "" ? null : fields[k];
  }
  for (const k of ["skills", "languages", "experience", "education", "certifications", "projects"]) {
    if (k in values && values[k] === null) values[k] = [];
  }
  if ("candidate_status" in values && !values.candidate_status) values.candidate_status = "Active";
  return values;
}

/** Add a new candidate. Returns the new id. */
export async function createCandidate(user: User, fields: Record<string, unknown>): Promise<string> {
  const values = cleanFields(fields);
  if (!values.full_name) throw new ApiError("A candidate needs a name.");
  const vector = await embed(user.db, embeddingText(values), { title: String(values.full_name) });
  const row = (await user.db.insert<{ id: string }>("candidates", [{ ...values, ...(vector ? { embedding: vector } : {}), owner: user.uid }]))[0];
  await audit(user, "candidate_created", { candidate_id: row.id, name: values.full_name });
  return row.id;
}

/** People already in the database with the same file or the same email. */
export async function duplicates(user: User, fileHash: string | null, email: string | null) {
  const ids = new Set<string>();
  if (fileHash) {
    for (const r of await user.db.select<{ candidate_id: string }>("resumes", { file_hash: `eq.${fileHash}`, select: "candidate_id" })) ids.add(r.candidate_id);
  }
  if (email && email.trim()) {
    for (const r of await user.db.select<{ id: string }>("candidates", { email: `ilike.${email.trim()}`, select: "id" })) ids.add(r.id);
  }
  if (!ids.size) return [];
  return user.db.select<{ id: string; full_name: string; current_title: string | null; email: string | null }>(
    "candidates", { id: inList(ids), select: "id,full_name,current_title,email" });
}

/** Save changed fields of a candidate, and refresh its entry in meaning-based search when the AI key is set. */
export async function saveCandidate(user: User, id: string, fields: Record<string, unknown>): Promise<void> {
  const values = cleanFields(fields);
  if ("full_name" in values && !values.full_name) throw new ApiError("A candidate needs a name.");
  const changed = Object.keys(values).filter((k) => k !== "resume_text").sort();
  if (!changed.length) return;
  const current = (await user.db.select("candidates", { id: `eq.${id}`, select: CANDIDATE_COLS }))[0];
  if (!current) throw new ApiError("This candidate no longer exists.", 404);
  const merged = { ...current, ...values };
  const vector = await embed(user.db, embeddingText(merged), { title: merged.full_name || "none" });
  await user.db.update("candidates", vector ? { ...values, embedding: vector } : values, { id: `eq.${id}` });
  await audit(user, "candidate_updated", { candidate_id: id, fields: changed });
}

export async function addToRole(user: User, roleId: string, candidateIds: string[]): Promise<number> {
  const ids = [...new Set(candidateIds)].filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  if (!ids.length) return 0;
  const first = (await stages(user))[0]?.id ?? null;
  const rows = ids.map((c) => ({ role_id: roleId, candidate_id: c, stage_id: first, added_by: user.uid, stage_changed_by_name: user.name }));
  const added = await user.db.insert<{ candidate_id: string }>("role_candidates", rows, { onConflict: "role_id,candidate_id", ignoreDuplicates: true });
  await audit(user, "added_to_role", { role_id: roleId, candidates: added.map((r) => r.candidate_id) });
  return added.length;
}

export async function addNote(user: User, candidateId: string, body: string, roleId: string | null = null): Promise<void> {
  if (!body.trim()) throw new ApiError("Write something first.");
  await user.db.insert("notes", [{ candidate_id: candidateId, role_id: roleId, body: body.trim().slice(0, 8000), author: user.uid, author_name: user.name }],
                       { returning: false });
  await audit(user, "note_added", { candidate_id: candidateId, role_id: roleId });
}

export async function markReviewed(user: User, candidateId: string): Promise<void> {
  await user.db.update("candidates", { review_status: "Reviewed" }, { id: `eq.${candidateId}` });
  await audit(user, "candidate_reviewed", { candidate_id: candidateId });
}

export async function deleteCandidate(user: User, id: string): Promise<void> {
  if (!user.isAdmin) throw new ApiError("Only an admin can delete a candidate.", 403);
  const row = (await user.db.select<{ full_name: string }>("candidates", { id: `eq.${id}`, select: "full_name" }))[0];
  await user.db.remove("candidates", { id: `eq.${id}` });
  await audit(user, "candidate_deleted", { candidate_id: id, name: row?.full_name ?? null });
}
