/** The search screen's filters: read from the address bar, sent to the database, shown as chips. */
import { list, years } from "./format";

export type Raw = Record<string, string | string[] | undefined>;

export const STATUSES = ["Active", "Placed", "Not available", "Do not contact"];
export const SORTS: [string, string][] = [
  ["match", "Best match"], ["newest", "Newest added"], ["updated", "Recently updated"],
  ["experience", "Most experience"], ["name", "Name, A to Z"],
];
export const SIZES = [25, 50, 100];

export type Filters = {
  q: string;
  expFrom: number | null; expTo: number | null;
  cities: string[]; title: string; company: string; education: string;
  skills: string[]; skillsMode: "all" | "any";
  status: string[]; review: "" | "unreviewed" | "reviewed";
  role: string; stage: string; inRole: "" | "any" | "none";
  addedFrom: string; addedTo: string;
  notice: string; resume: "" | "yes" | "no";
  sort: string; size: number; page: number;
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v || "").trim();
const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []).flatMap((x) => list(x));
const num = (v: string) => (v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.min(60, Number(v)) : null);
const day = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const uuid = (v: string) => (/^[0-9a-f-]{36}$/i.test(v) ? v : "");

export function readFilters(sp: Raw): Filters {
  let expFrom = num(one(sp.exp_from)), expTo = num(one(sp.exp_to));
  if (expFrom !== null && expTo !== null && expFrom > expTo) [expFrom, expTo] = [expTo, expFrom];
  const q = one(sp.q).slice(0, 400);
  const sort = SORTS.some(([k]) => k === one(sp.sort)) ? one(sp.sort) : "";
  const size = Number(one(sp.size));
  const review = one(sp.review), inRole = one(sp.in_role), resume = one(sp.resume);
  return {
    q, expFrom, expTo,
    cities: many(sp.city).slice(0, 12), title: one(sp.title), company: one(sp.company), education: one(sp.education),
    skills: many(sp.skills).slice(0, 20), skillsMode: one(sp.skills_mode) === "any" ? "any" : "all",
    status: many(sp.status).filter((s) => STATUSES.includes(s)),
    review: review === "unreviewed" || review === "reviewed" ? review : "",
    role: uuid(one(sp.role)), stage: uuid(one(sp.stage)),
    inRole: inRole === "any" || inRole === "none" ? inRole : "",
    addedFrom: day(one(sp.added_from)), addedTo: day(one(sp.added_to)),
    notice: one(sp.notice), resume: resume === "yes" || resume === "no" ? resume : "",
    sort: sort || (q ? "match" : "updated"),
    size: size >= 5 && size <= 200 ? Math.floor(size) : 50,
    page: Math.max(1, Math.floor(Number(one(sp.page)) || 1)),
  };
}

/** Recruiter-style boolean text -> the form Postgres web search understands (as in the desktop app). */
export function toWebsearch(q: string): string {
  return q.replace(/[()]/g, " ").replace(/\bNOT\s+/g, "-").replace(/\bAND\b/g, " ").replace(/\s+/g, " ").trim();
}

/** The arguments for the database's search function. "5 to 5 years" means everyone with five-point-something years. */
export function toArgs(f: Filters, embedding: string | null, limit = f.size, offset = (f.page - 1) * f.size) {
  const extra: Record<string, unknown> = { sort: f.sort };
  if (f.cities.length) extra.cities = f.cities;
  if (f.company) extra.company = f.company;
  if (f.skills.length && f.skillsMode === "any") extra.skills_any = f.skills;
  if (f.status.length) extra.status = f.status;
  if (f.review === "reviewed") extra.review = "reviewed";
  if (f.role) extra.role_id = f.role;
  if (f.stage) extra.stage_id = f.stage;
  if (f.inRole) extra.in_role = f.inRole;
  if (f.addedFrom) extra.added_from = f.addedFrom;
  if (f.addedTo) extra.added_to = f.addedTo;
  if (f.notice) extra.notice = f.notice;
  if (f.resume) extra.has_resume = f.resume === "yes";
  return {
    q: toWebsearch(f.q), q_embedding: embedding,
    min_exp: f.expFrom, max_exp: f.expTo === null ? null : f.expTo + 0.999,
    city_f: null, title_f: f.title || null, education_f: f.education || null,
    skills_f: f.skills.length && f.skillsMode === "all" ? f.skills : null,
    lim: limit, off: offset, unreviewed_only: f.review === "unreviewed", extra,
  };
}

/** The address for a search with some parts changed. Empty values are left out; page 1 is the default. */
export function searchHref(f: Filters, change: Partial<Filters> = {}): string {
  const g = { ...f, ...change };
  const p = new URLSearchParams();
  const put = (k: string, v: string | number | null) => { if (v !== "" && v !== null) p.set(k, String(v)); };
  put("q", g.q); put("exp_from", g.expFrom); put("exp_to", g.expTo);
  put("city", g.cities.join(", ")); put("title", g.title); put("company", g.company); put("education", g.education);
  put("skills", g.skills.join(", ")); if (g.skills.length && g.skillsMode === "any") p.set("skills_mode", "any");
  for (const s of g.status) p.append("status", s);
  put("review", g.review); put("role", g.role); put("stage", g.stage); put("in_role", g.inRole);
  put("added_from", g.addedFrom); put("added_to", g.addedTo); put("notice", g.notice); put("resume", g.resume);
  if (g.sort && g.sort !== (g.q ? "match" : "updated")) p.set("sort", g.sort);
  if (g.size !== 50) p.set("size", String(g.size));
  if (g.page > 1) p.set("page", String(g.page));
  const text = p.toString();
  return text ? `/search?${text}` : "/search";
}

export type Chip = { label: string; href: string };

/** One chip per filter in use, each with the address that removes it. */
export function chips(f: Filters, names: { roles: Record<string, string>; stages: Record<string, string> }): Chip[] {
  const out: Chip[] = [];
  const add = (label: string, change: Partial<Filters>) => out.push({ label, href: searchHref(f, { ...change, page: 1 }) });
  if (f.expFrom !== null || f.expTo !== null) {
    const label = f.expFrom !== null && f.expTo !== null
      ? (f.expFrom === f.expTo ? `Exactly ${years(f.expFrom)}` : `${f.expFrom} to ${years(f.expTo)}`)
      : f.expFrom !== null ? `${years(f.expFrom)} or more` : `Up to ${years(f.expTo)}`;
    add(label, { expFrom: null, expTo: null });
  }
  for (const c of f.cities) add(c, { cities: f.cities.filter((x) => x !== c) });
  if (f.title) add(`Title: ${f.title}`, { title: "" });
  if (f.company) add(`Company: ${f.company}`, { company: "" });
  if (f.education) add(`Education: ${f.education}`, { education: "" });
  for (const s of f.skills) add(f.skillsMode === "any" && f.skills.length > 1 ? `${s} (any)` : s, { skills: f.skills.filter((x) => x !== s) });
  for (const s of f.status) add(s, { status: f.status.filter((x) => x !== s) });
  if (f.review) add(f.review === "unreviewed" ? "Unreviewed" : "Reviewed", { review: "" });
  if (f.role) add(`In ${names.roles[f.role] || "a role"}`, { role: "", stage: "" });
  if (f.stage) add(`Stage: ${names.stages[f.stage] || "chosen"}`, { stage: "" });
  if (f.inRole) add(f.inRole === "any" ? "In at least one role" : "Not in any role", { inRole: "" });
  if (f.addedFrom || f.addedTo) {
    add(f.addedFrom && f.addedTo ? `Added ${f.addedFrom} to ${f.addedTo}` : f.addedFrom ? `Added since ${f.addedFrom}` : `Added until ${f.addedTo}`,
        { addedFrom: "", addedTo: "" });
  }
  if (f.notice) add(`Notice: ${f.notice}`, { notice: "" });
  if (f.resume) add(f.resume === "yes" ? "Has a resume file" : "No resume file", { resume: "" });
  return out;
}
