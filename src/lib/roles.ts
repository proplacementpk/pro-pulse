/** Roles: the list, one role with its candidates, and the changes people make inside a role. */
import { stages, type Role } from "./data";
import { ApiError, inList } from "./supabase";
import { audit, type User } from "./user";

export type RoleRow = Role & { counts: Record<string, number>; total: number };
export type Member = {
  rc_id: string; candidate_id: string; stage_id: string | null; stage_changed_at: string | null; stage_changed_by_name: string | null;
  full_name: string; current_title: string | null; current_company: string | null; city: string | null;
  total_experience_years: number | null; review_status: string | null; email: string | null; phone: string | null;
};
export type Person = { id: string; full_name: string | null; email: string; user_type: string };

const ROLE_COLS = "id,title,department,location,status,description,assigned_to,assigned_name,created_at";
const chunks = <T,>(items: T[], n = 60) => Array.from({ length: Math.ceil(items.length / n) }, (_, i) => items.slice(i * n, i * n + n));
const isId = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

export async function listRoles(user: User): Promise<RoleRow[]> {
  const [roles, rcs] = await Promise.all([
    user.db.select<Role>("job_roles", { select: ROLE_COLS, order: "created_at.desc" }),
    user.db.select<{ role_id: string; stage_id: string | null }>("role_candidates", { select: "role_id,stage_id" }),
  ]);
  const counts: Record<string, Record<string, number>> = {};
  for (const rc of rcs) {
    counts[rc.role_id] ??= {};
    const k = rc.stage_id || "none";
    counts[rc.role_id][k] = (counts[rc.role_id][k] || 0) + 1;
  }
  return roles.map((r) => ({ ...r, counts: counts[r.id] || {}, total: Object.values(counts[r.id] || {}).reduce((a, b) => a + b, 0) }));
}

export async function people(user: User): Promise<Person[]> {
  return user.db.select<Person>("profiles", { active: "eq.true", select: "id,full_name,email,user_type", order: "full_name.asc" });
}

export async function getRole(user: User, id: string): Promise<{ role: Role; members: Member[]; notes: Record<string, { id: string; body: string; author_name: string | null; created_at: string }[]> } | null> {
  if (!isId(id)) return null;
  const role = (await user.db.select<Role>("job_roles", { id: `eq.${id}`, select: ROLE_COLS }))[0];
  if (!role) return null;
  const rcs = await user.db.select<{ id: string; candidate_id: string; stage_id: string | null; stage_changed_at: string | null; stage_changed_by_name: string | null }>(
    "role_candidates", { role_id: `eq.${id}`, order: "added_at.asc", select: "id,candidate_id,stage_id,stage_changed_at,stage_changed_by_name" });
  const found: Record<string, any> = {};
  for (const part of chunks(rcs.map((x) => x.candidate_id))) {
    for (const c of await user.db.select("candidates", { id: inList(part),
      select: "id,full_name,current_title,current_company,city,total_experience_years,review_status,email,phone" })) found[c.id] = c;
  }
  const notes: Record<string, { id: string; body: string; author_name: string | null; created_at: string }[]> = {};
  for (const n of await user.db.select<{ id: string; candidate_id: string; body: string; author_name: string | null; created_at: string }>(
    "notes", { role_id: `eq.${id}`, order: "created_at.desc", select: "id,candidate_id,body,author_name,created_at" })) {
    (notes[n.candidate_id] ??= []).push(n);
  }
  const members = rcs.filter((x) => found[x.candidate_id]).map((x) => ({
    ...found[x.candidate_id], rc_id: x.id, candidate_id: x.candidate_id, stage_id: x.stage_id,
    stage_changed_at: x.stage_changed_at, stage_changed_by_name: x.stage_changed_by_name })) as Member[];
  return { role, members, notes };
}

export async function saveRole(user: User, fields: Record<string, string>, id: string | null): Promise<string> {
  const title = (fields.title || "").trim();
  if (!title) throw new ApiError("A role needs a title.");
  const person = fields.assigned_to ? (await people(user)).find((p) => p.id === fields.assigned_to) : undefined;
  const values: Record<string, unknown> = {
    title, department: fields.department?.trim() || null, location: fields.location?.trim() || null,
    description: fields.description?.trim() || null,
    status: ["Open", "On hold", "Closed"].includes(fields.status) ? fields.status : "Open",
    assigned_to: person?.id ?? null, assigned_name: person ? person.full_name || person.email : null,
  };
  if (id) {
    await user.db.update("job_roles", values, { id: `eq.${id}` });
    await audit(user, "role_updated", { role_id: id, title, consultant: values.assigned_name });
    return id;
  }
  const row = (await user.db.insert<{ id: string }>("job_roles", [{ ...values, owner: user.uid, owner_name: user.name }]))[0];
  await audit(user, "role_created", { role_id: row.id, title, consultant: values.assigned_name });
  return row.id;
}

export async function deleteRole(user: User, id: string): Promise<void> {
  if (!user.isAdmin) throw new ApiError("Only an admin can delete a role.", 403);
  const role = (await user.db.select<{ title: string }>("job_roles", { id: `eq.${id}`, select: "title" }))[0];
  const n = await user.db.count("role_candidates", { role_id: `eq.${id}` });
  await user.db.remove("job_roles", { id: `eq.${id}` });
  await audit(user, "role_deleted", { role_id: id, title: role?.title ?? null, candidates: n });
}

export async function setStage(user: User, rcIds: string[], stageId: string): Promise<void> {
  const ids = rcIds.filter(isId);
  if (!ids.length || !isId(stageId)) throw new ApiError("Tick one or more candidates first.");
  for (const part of chunks(ids)) {
    await user.db.update("role_candidates", { stage_id: stageId, stage_changed_by_name: user.name }, { id: inList(part) });
  }
  const name = (await stages(user)).find((s) => s.id === stageId)?.name || stageId;
  await audit(user, "stage_changed", { stage: name, count: ids.length, role_candidates: ids });
}

export async function removeFromRole(user: User, rcIds: string[]): Promise<void> {
  const ids = rcIds.filter(isId);
  if (!ids.length) throw new ApiError("Tick one or more candidates first.");
  for (const part of chunks(ids)) await user.db.remove("role_candidates", { id: inList(part) });
  await audit(user, "removed_from_role", { count: ids.length, role_candidates: ids });
}

/** Rows for an Excel sheet: the candidates' details, their latest resume link and note, the stage in
 *  this role (when a role is given) and every role and stage they are in. */
export async function exportRows(user: User, candidateIds: string[], roleId: string | null): Promise<Record<string, any>[]> {
  const ids = [...new Set(candidateIds)].filter(isId);
  const stageNames = Object.fromEntries((await stages(user)).map((s) => [s.id, s.name]));
  const titles = Object.fromEntries((await user.db.select<{ id: string; title: string }>("job_roles", { select: "id,title" })).map((r) => [r.id, r.title]));
  const found: Record<string, any> = {}, links: Record<string, string> = {}, notes: Record<string, string> = {};
  const stageOf: Record<string, string> = {}, inRoles: Record<string, string[]> = {};
  for (const part of chunks(ids)) {
    const list = inList(part);
    const [cands, resumes, noteRows, rcs] = await Promise.all([
      user.db.select("candidates", { id: list, select: "id,full_name,current_title,current_company,city,total_experience_years,highest_education,phone,email,skills,linkedin_url,current_salary,expected_salary,notice_period,candidate_status" }),
      user.db.select<{ candidate_id: string; drive_link: string | null }>("resumes", { candidate_id: list, order: "uploaded_at.asc", select: "candidate_id,drive_link" }),
      user.db.select<{ candidate_id: string; body: string; role_id: string | null }>("notes", { candidate_id: list, order: "created_at.asc", select: "candidate_id,body,role_id" }),
      user.db.select<{ candidate_id: string; role_id: string; stage_id: string | null }>("role_candidates", { candidate_id: list, select: "candidate_id,role_id,stage_id" }),
    ]);
    for (const c of cands) found[c.id] = c;
    for (const r of resumes) if (r.drive_link) links[r.candidate_id] = r.drive_link;
    for (const n of noteRows) if (!roleId || n.role_id === roleId) notes[n.candidate_id] = n.body;
    for (const rc of rcs) {
      const stage = (rc.stage_id && stageNames[rc.stage_id]) || "No stage";
      if (rc.role_id === roleId) stageOf[rc.candidate_id] = stage;
      (inRoles[rc.candidate_id] ??= []).push(`${titles[rc.role_id] || "Role"}: ${stage}`);
    }
  }
  const rows = ids.filter((i) => found[i]).map((i) => ({
    ...found[i], drive_link: links[i] || null, latest_note: notes[i] || null,
    stage: roleId ? stageOf[i] || "No stage" : null, roles_stages: (inRoles[i] || []).sort().join("; ") || null,
  }));
  await audit(user, "export", { rows: rows.length, role_id: roleId });
  return rows;
}
