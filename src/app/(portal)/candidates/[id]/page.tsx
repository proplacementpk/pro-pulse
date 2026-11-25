import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { getCandidate, roles as loadRoles, stages as loadStages } from "@/lib/data";
import { fileSize, niceDate, years } from "@/lib/format";
import { driveReady } from "@/lib/google";
import { requireUser } from "@/lib/user";
import { markReviewedAction } from "../actions";
import { MoreMenu, NoteForm, RoleForm } from "./forms";

export const metadata: Metadata = { title: "Candidate" };

const text = (v: unknown) => (Array.isArray(v) ? v.join(", ") : v === null || v === undefined ? "" : String(v));
const web = (url: string) => (/^https?:\/\//i.test(url) ? url : "https://" + url);

export default async function CandidatePage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; added?: string }>;
}) {
  const { id } = await params;
  const { saved, added } = await searchParams;
  const user = await requireUser();
  const [c, allRoles, stages] = await Promise.all([getCandidate(user, id), loadRoles(user), loadStages(user)]);
  if (!c) notFound();
  const stageOf = Object.fromEntries(stages.map((s) => [s.id, s]));
  const inRoles = new Set(c.roles.map((r) => r.role_id));
  const openRoles = allRoles.filter((r) => r.status !== "Closed" && !inRoles.has(r.id))
    .sort((a, b) => Number(b.status === "Open") - Number(a.status === "Open")).map((r) => ({ id: r.id, title: r.title }));
  const headline = [c.current_title, c.current_company].filter(Boolean).join(" at ");
  const status = c.candidate_status || "Active";
  const pay: [string, string][] = ([
    ["Current salary", text(c.current_salary)], ["Expected salary", text(c.expected_salary)], ["Notice period", text(c.notice_period)],
    ["Benefits", text(c.benefits)], ["Open to relocating", c.willing_to_relocate === true ? "Yes" : c.willing_to_relocate === false ? "No" : ""],
    ["Preferred locations", text(c.preferred_locations)],
  ] as [string, string][]).filter(([, v]) => v);
  const about: [string, string][] = ([
    ["Experience", years(c.total_experience_years)], ["Education", text(c.highest_education)], ["Industry", text(c.industry)],
    ["Function", text(c.functional_area)], ["Level", text(c.seniority_level)], ["Languages", text(c.languages)],
    ["Nationality", text(c.nationality)], ["Added", niceDate(c.created_at)], ["Last changed", niceDate(c.updated_at)],
  ] as [string, string][]).filter(([, v]) => v);

  return (
    <>
      <Link className="back" href="/search"><Icon name="back" />Search</Link>
      {saved && <p className="notice good" role="status" style={{ marginBottom: 12 }}>Changes saved</p>}
      {added === "1" && <p className="notice good" role="status" style={{ marginBottom: 12 }}>Saved, and the resume is stored in Google Drive</p>}
      {added === "nofile" && <p className="notice warn" role="status" style={{ marginBottom: 12 }}>The details were saved, but the file itself was not stored in Google Drive.</p>}

      <section className="panel profile-head">
        <div className="top">
          <div style={{ minWidth: 0 }}>
            <div className="title-line">
              <h1>{c.full_name}</h1>
              <span className={"tag " + (status === "Active" ? "good" : status === "Do not contact" ? "bad" : "")}>{status}</span>
              {c.review_status === "Unreviewed" && <span className="tag warn">Unreviewed</span>}
            </div>
            {headline && <p className="headline">{headline}</p>}
          </div>
          <div className="actions">
            {c.review_status === "Unreviewed" && (
              <form action={markReviewedAction}>
                <input type="hidden" name="candidate" value={c.id} />
                <button className="btn" type="submit" title="Say that someone has checked these details"><Icon name="check" />Mark reviewed</button>
              </form>
            )}
            <Link className="btn primary" href={`/candidates/${c.id}/edit`}><Icon name="edit" />Edit</Link>
            {user.isAdmin && <MoreMenu id={c.id} name={c.full_name} />}
          </div>
        </div>
        <div className="contact">
          {(c.city || c.country) && <span><Icon name="pin" />{[c.city, c.country].filter(Boolean).join(", ")}</span>}
          {c.email && <a href={`mailto:${c.email}`}><Icon name="mail" />{c.email}</a>}
          {c.alternate_email && <a href={`mailto:${c.alternate_email}`}><Icon name="mail" />{c.alternate_email}</a>}
          {c.phone && <a href={`tel:${String(c.phone).replace(/[^\d+]/g, "")}`}><Icon name="phone" />{c.phone}</a>}
          {c.alternate_phone && <a href={`tel:${String(c.alternate_phone).replace(/[^\d+]/g, "")}`}><Icon name="phone" />{c.alternate_phone}</a>}
          {c.linkedin_url && <a href={web(c.linkedin_url)} target="_blank" rel="noreferrer noopener"><Icon name="link" />LinkedIn</a>}
          {c.portfolio_url && <a href={web(c.portfolio_url)} target="_blank" rel="noreferrer noopener"><Icon name="link" />Portfolio</a>}
        </div>
      </section>

      <div className="cols">
        <div className="stack">
          {c.summary && <section className="panel card"><h2>Summary</h2><p className="lead">{c.summary}</p></section>}
          {(c.skills || []).length > 0 && (
            <section className="panel card"><h2>Skills</h2><div className="tags">{c.skills.map((s: string) => <span className="tag" key={s}>{s}</span>)}</div></section>
          )}
          {(c.experience || []).length > 0 && (
            <section className="panel card">
              <h2>Experience</h2>
              <div className="timeline">
                {c.experience.map((j: any, i: number) => (
                  <div className="item" key={i}>
                    <div className="when">{[j.start_date, j.end_date].filter(Boolean).join(" to ")}</div>
                    <div className="what">
                      <b>{j.job_title || "Role"}</b>{j.company ? `, ${j.company}` : ""}{j.location ? `, ${j.location}` : ""}
                      {j.description && <p>{j.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          {(c.education || []).length > 0 && (
            <section className="panel card">
              <h2>Education</h2>
              <div className="timeline">
                {c.education.map((e: any, i: number) => (
                  <div className="item" key={i}>
                    <div className="when">{[e.start_year, e.end_year].filter(Boolean).join(" to ")}</div>
                    <div className="what"><b>{[e.degree, e.field_of_study].filter(Boolean).join(", ") || "Study"}</b>{e.institution ? `, ${e.institution}` : ""}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
          {(c.certifications || []).length > 0 && (
            <section className="panel card"><h2>Certifications</h2>
              <ul className="line-list">{c.certifications.map((x: any, i: number) => <li key={i}>{typeof x === "string" ? x : [x.name, x.issuer, x.year].filter(Boolean).join(", ")}</li>)}</ul>
            </section>
          )}
          <section className="panel card">
            <h2>Notes</h2>
            <NoteForm candidate={c.id} />
            <div style={{ marginTop: 14 }}>
              {c.notes.map((n) => (
                <div className="note" key={n.id}>
                  <p>{n.body}</p>
                  <div className="by">{n.author_name || "Someone"}, {niceDate(n.created_at, true)}{n.role_id && allRoles.find((r) => r.id === n.role_id) ? `, in ${allRoles.find((r) => r.id === n.role_id)!.title}` : ""}</div>
                </div>
              ))}
              {!c.notes.length && <p className="muted small">No notes yet.</p>}
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="panel card">
            <h2>Roles</h2>
            {c.roles.length > 0 && (
              <ul className="line-list" style={{ marginBottom: 12 }}>
                {c.roles.map((r) => (
                  <li key={r.rc_id}><span>{r.title}</span><span className="tag">{r.stage_id && stageOf[r.stage_id] ? stageOf[r.stage_id].name : "No stage"}</span></li>
                ))}
              </ul>
            )}
            <RoleForm candidate={c.id} roles={openRoles} />
          </section>
          <section className="panel card">
            <h2>Resume files</h2>
            {c.resumes.length ? (
              <ul className="line-list">
                {c.resumes.map((r) => {
                  const can = r.drive_file_id ? driveReady() : Boolean(r.drive_link);
                  return (
                    <li key={r.id}>
                      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                        <div>{r.original_file_name}</div>
                        <div className="muted small">{[niceDate(r.uploaded_at), fileSize(r.file_size)].filter(Boolean).join(", ")}</div>
                      </span>
                      {can ? <a className="btn small" href={`/api/resumes/${r.id}`} target="_blank" rel="noreferrer"><Icon name="file" />Open</a>
                           : <span className="muted small nowrap" title={r.drive_file_id ? "Google Drive is not set up on the web portal yet" : "Only the details were saved, not the file"}>{r.drive_file_id ? "Not available here" : "Not stored"}</span>}
                    </li>
                  );
                })}
              </ul>
            ) : <p className="muted small">No resume file on this profile.</p>}
          </section>
          {pay.length > 0 && (
            <section className="panel card"><h2>Pay and availability</h2>
              <dl className="facts-grid">{pay.map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            </section>
          )}
          {about.length > 0 && (
            <section className="panel card"><h2>About</h2>
              <dl className="facts-grid">{about.map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
