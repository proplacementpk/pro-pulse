import type { Metadata } from "next";
import Link from "next/link";
import { AutoSelect, FilterPanel, SearchForm } from "@/components/client";
import { Icon } from "@/components/icons";
import { roles as loadRoles, search, stages as loadStages } from "@/lib/data";
import { plural } from "@/lib/format";
import { emailReady } from "@/lib/brevo";
import { aiReady } from "@/lib/gemini";
import { people } from "@/lib/roles";
import { chips, readFilters, searchHref, SIZES, SORTS, STATUSES, type Raw } from "@/lib/search";
import { requireUser } from "@/lib/user";
import { Results } from "./results";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<Raw> }) {
  const raw = await searchParams;
  const user = await requireUser();
  const f = readFilters(raw);
  const [allRoles, stages] = await Promise.all([loadRoles(user), loadStages(user)]);
  let found: Awaited<ReturnType<typeof search>> | null = null;
  let error = "";
  try {
    found = await search(user, f);
  } catch (e) {
    error = e instanceof Error ? e.message : "Search did not run. Try again.";
  }
  const names = { roles: Object.fromEntries(allRoles.map((r) => [r.id, r.title])), stages: Object.fromEntries(stages.map((s) => [s.id, s.name])) };
  const active = chips(f, names);
  const total = found?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / f.size));
  const first = (f.page - 1) * f.size + 1;
  const words = [...f.q.toLowerCase().match(/[a-z0-9+#]{2,}/g) || [], ...f.skills.map((s) => s.toLowerCase())]
    .filter((w) => !["and", "or", "not"].includes(w));
  const openRoles = allRoles.filter((r) => r.status !== "Closed").sort((a, b) => Number(b.status === "Open") - Number(a.status === "Open"))
    .map((r) => ({ id: r.id, title: r.title }));
  // the ticks belong to one search: the same words and filters, whatever the page or order
  const searchKey = searchHref(f, { page: 1, sort: "", size: 50 });
  const sorts = SORTS.filter(([k]) => k !== "match" || f.q);
  const team = user.isAdmin ? (await people(user)).map((p) => ({ name: p.full_name || p.email, email: p.email })) : [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Search candidates</h1>
          <p className="sub">Words, filters and meaning in one ranked list. AND, OR and NOT work.</p>
        </div>
      </div>

      {raw.deleted && <p className="notice good" role="status" style={{ marginBottom: 12 }}>Candidate deleted</p>}
      <SearchForm key={searchKey}>
        <div className="query">
          <input className="input" name="q" defaultValue={f.q} placeholder="plant manager AND (UHT OR pasteurisation) NOT intern" aria-label="Search words" autoComplete="off" />
          <button className="btn primary" type="submit"><Icon name="search" /><span>Search</span></button>
        </div>

        <div className="search-grid">
          <FilterPanel count={active.length}>

            <div className="group">
              <span className="label">Experience, in years</span>
              <div className="pair">
                <input className="input" name="exp_from" type="number" min={0} max={60} step={1} defaultValue={f.expFrom ?? ""} placeholder="From" aria-label="Experience from, years" />
                <input className="input" name="exp_to" type="number" min={0} max={60} step={1} defaultValue={f.expTo ?? ""} placeholder="To" aria-label="Experience to, years" />
              </div>
              <span className="hint small muted">Use the same number in both for exactly that many years.</span>
            </div>

            <div className="group">
              <div className="field">
                <label htmlFor="f-city">City</label>
                <input className="input" id="f-city" name="city" defaultValue={f.cities.join(", ")} placeholder="Karachi, Lahore" />
                <span className="hint">Several cities, separated by commas</span>
              </div>
              <div className="field">
                <label htmlFor="f-title">Current title</label>
                <input className="input" id="f-title" name="title" defaultValue={f.title} placeholder="Production manager" />
              </div>
              <div className="field">
                <label htmlFor="f-company">Current company</label>
                <input className="input" id="f-company" name="company" defaultValue={f.company} />
              </div>
              <div className="field">
                <label htmlFor="f-education">Education</label>
                <input className="input" id="f-education" name="education" defaultValue={f.education} placeholder="MBA, BSc Food" />
              </div>
            </div>

            <div className="group">
              <div className="field">
                <label htmlFor="f-skills">Skills</label>
                <input className="input" id="f-skills" name="skills" defaultValue={f.skills.join(", ")} placeholder="HACCP, UHT" />
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <label className="check"><input type="radio" name="skills_mode" value="all" defaultChecked={f.skillsMode === "all"} />All of them</label>
                <label className="check"><input type="radio" name="skills_mode" value="any" defaultChecked={f.skillsMode === "any"} />Any one</label>
              </div>
            </div>

            <div className="group">
              <span className="label">Status</span>
              {STATUSES.map((s) => (
                <label className="check" key={s}><input type="checkbox" name="status" value={s} defaultChecked={f.status.includes(s)} />{s}</label>
              ))}
              <div className="field">
                <label htmlFor="f-review">Checked by someone</label>
                <select className="input" id="f-review" name="review" defaultValue={f.review}>
                  <option value="">Either</option>
                  <option value="reviewed">Reviewed only</option>
                  <option value="unreviewed">Unreviewed only</option>
                </select>
              </div>
            </div>

            <div className="group">
              <div className="field">
                <label htmlFor="f-in-role">Roles</label>
                <select className="input" id="f-in-role" name="in_role" defaultValue={f.inRole}>
                  <option value="">In a role or not</option>
                  <option value="any">In at least one role</option>
                  <option value="none">Not in any role yet</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="f-role">In this role</label>
                <select className="input" id="f-role" name="role" defaultValue={f.role}>
                  <option value="">Any role</option>
                  {allRoles.map((r) => <option key={r.id} value={r.id}>{r.title}{r.status === "Open" ? "" : ` (${r.status.toLowerCase()})`}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="f-stage">At this stage</label>
                <select className="input" id="f-stage" name="stage" defaultValue={f.stage}>
                  <option value="">Any stage</option>
                  {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="group">
              <span className="label">Added to the database</span>
              <div className="pair">
                <input className="input" name="added_from" type="date" defaultValue={f.addedFrom} aria-label="Added from" />
                <input className="input" name="added_to" type="date" defaultValue={f.addedTo} aria-label="Added until" />
              </div>
              <div className="field">
                <label htmlFor="f-notice">Notice period</label>
                <input className="input" id="f-notice" name="notice" defaultValue={f.notice} placeholder="1 month, immediate" />
              </div>
              <div className="field">
                <label htmlFor="f-resume">Resume file</label>
                <select className="input" id="f-resume" name="resume" defaultValue={f.resume}>
                  <option value="">With or without</option>
                  <option value="yes">Has a resume file</option>
                  <option value="no">No resume file</option>
                </select>
              </div>
            </div>

            <div className="actions">
              <button className="btn primary" type="submit">Apply filters</button>
              <Link className="btn" href="/search">Clear all</Link>
            </div>
          </FilterPanel>

          <section aria-label="Results">
            <div className="results-head">
              <span className="total" data-testid="total">{error ? "Search did not run" : plural(total, "candidate")}</span>
              <div className="controls">
                <AutoSelect name="sort" value={f.sort} options={sorts} label="Order of the list" />
                <AutoSelect name="size" value={String(f.size)} label="Candidates per page"
                            options={[...new Set([...SIZES, f.size])].sort((a, b) => a - b).map((n) => [String(n), `${n} per page`])} />
              </div>
            </div>
            {active.length > 0 && (
              <div className="chips" aria-label="Filters in use">
                {active.map((c) => (
                  <Link key={c.label} className="chip" href={c.href} title={`Remove: ${c.label}`}>{c.label}<Icon name="x" /></Link>
                ))}
                <Link className="chip clear" href={searchHref(f, { ...readFilters({}), q: f.q, sort: f.sort, size: f.size })}>Clear filters</Link>
              </div>
            )}
            {error ? (
              <div className="panel empty"><h2>Search did not run</h2><p>{error}</p></div>
            ) : !found || !found.rows.length ? (
              <div className="panel empty">
                <h2>No candidates match</h2>
                <p>{active.length ? "Remove a filter above, or widen the experience range." : f.q ? "Try other words, or fewer of them." : "The database has no candidates yet. They are added from Add resume or the desktop app."}</p>
              </div>
            ) : (
              <Results rows={found.rows} total={total} words={words} roles={openRoles} searchKey={searchKey} params={raw}
                       isAdmin={user.isAdmin} ownEmail={user.profile.email} team={team} canEmail={emailReady()} />
            )}
            {found && total > 0 && (
              <div className="pager">
                <span className="muted" data-testid="range">
                  Showing {first.toLocaleString("en")} to {(first + found.rows.length - 1).toLocaleString("en")} of {total.toLocaleString("en")}
                  {f.q && !found.meaning && aiReady() ? ", by words only" : ""}
                </span>
                <div className="steps">
                  <Link className="btn small" href={searchHref(f, { page: f.page - 1 })} aria-disabled={f.page <= 1} rel="prev"><Icon name="back" />Previous</Link>
                  <span className="nowrap">Page {f.page} of {pages}</span>
                  <Link className="btn small" href={searchHref(f, { page: f.page + 1 })} aria-disabled={f.page >= pages} rel="next">Next<Icon name="next" /></Link>
                </div>
              </div>
            )}
          </section>
        </div>
      </SearchForm>
    </>
  );
}
