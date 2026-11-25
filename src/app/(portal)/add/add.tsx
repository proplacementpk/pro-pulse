"use client";
/** Adding one resume: choose the file, wait while it is read, check the details, save. The file
 *  stays in the browser between the two steps, so the server keeps nothing it was not asked to save. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Icon, PULSE } from "@/components/icons";

type Dup = { id: string; full_name: string; current_title: string | null; email: string | null };
type Parsed = Record<string, any>;
type Step = "choose" | "reading" | "review" | "saving";

const FIELDS: [string, string, { type?: string; wide?: boolean }?][] = [
  ["full_name", "Full name"], ["current_title", "Current title"], ["current_company", "Current company"],
  ["total_experience_years", "Experience, in years", { type: "number" }], ["highest_education", "Highest education"],
  ["email", "Email", { type: "email" }], ["phone", "Phone"], ["city", "City"], ["country", "Country"],
  ["linkedin_url", "LinkedIn", { wide: true }],
];
const NAMES: Record<string, string> = Object.fromEntries(FIELDS.map(([k, label]) => [k, label]));

export function AddResume({ ai, drive, maxMb }: { ai: boolean; drive: boolean; maxMb: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("choose");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<Parsed>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [dups, setDups] = useState<Dup[]>([]);
  const [choice, setChoice] = useState("new");
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);

  async function read(f: File | null | undefined) {
    if (!f) return;
    setError("");
    if (f.size > maxMb * 1024 * 1024) return setError(`That file is larger than ${maxMb} MB. Add it from the desktop app instead.`);
    setFile(f); setStep("reading");
    const body = new FormData(); body.append("file", f);
    try {
      const res = await fetch("/api/resumes/parse", { method: "POST", body });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "The resume could not be read.");
      const p: Parsed = out.parsed;
      const v: Record<string, string> = { skills: (p.skills || []).join(", "), summary: p.summary || "", expected_salary: "", notice_period: "" };
      for (const [k] of FIELDS) v[k] = p[k] === null || p[k] === undefined ? "" : String(p[k]);
      setParsed(p); setValues(v); setDups(out.duplicates || []);
      setChoice(out.duplicates?.length ? `update:${out.duplicates[0].id}` : "new");
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The resume could not be read.");
      setStep("choose");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    const [mode, target] = choice.split(":");
    if (mode !== "attach" && !values.full_name?.trim()) return setError("A candidate needs a name.");
    setError(""); setStep("saving");
    const years = values.total_experience_years?.trim();
    const fields: Parsed = { ...parsed };
    for (const [k] of FIELDS) fields[k] = values[k]?.trim() || null;
    fields.total_experience_years = years && Number.isFinite(Number(years)) ? Number(years) : null;
    fields.skills = values.skills.split(",").map((s) => s.trim()).filter(Boolean);
    fields.summary = values.summary.trim() || null;
    if (values.expected_salary.trim()) fields.expected_salary = values.expected_salary.trim();
    if (values.notice_period.trim()) fields.notice_period = values.notice_period.trim();
    delete fields.fields_to_check; delete fields.resume_language;
    const body = new FormData();
    body.append("file", file); body.append("fields", JSON.stringify(fields)); body.append("mode", mode); body.append("target", target || "");
    try {
      const res = await fetch("/api/resumes/save", { method: "POST", body });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "The candidate could not be saved.");
      router.push(`/candidates/${out.candidate_id}?added=${out.warning ? "nofile" : "1"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The candidate could not be saved.");
      setStep("review");
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues({ ...values, [k]: e.target.value });
  const unsure: string[] = (parsed.fields_to_check || []).filter((k: string) => NAMES[k] || ["skills", "summary", "experience", "education"].includes(k));
  const flag = (k: string) => (unsure.includes(k) ? <span className="tag warn">Check this</span> : null);

  if (step === "reading" || step === "saving") {
    return (
      <div className="panel pulse-loader" role="status">
        <svg viewBox="0 0 180 48"><path d={PULSE} /></svg>
        <span>{step === "reading" ? `Reading ${file?.name}. This takes up to a minute.` : "Saving the candidate and storing the file"}</span>
      </div>
    );
  }

  if (step === "choose") {
    return (
      <div className="stack" style={{ maxWidth: 760 }}>
        {!ai && <p className="notice warn">Reading resumes is not set up on the web portal yet. An admin adds the Gemini key on the host. Until then, add resumes from the desktop app.</p>}
        {ai && !drive && <p className="notice warn">Google Drive is not set up on the web portal yet. Details will be saved, but the file itself will not be stored.</p>}
        {error && <p className="notice bad" role="alert">{error}</p>}
        <label className={"panel drop" + (over ? " over" : "")}
               onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
               onDrop={(e) => { e.preventDefault(); setOver(false); if (ai) read(e.dataTransfer.files[0]); }}>
          <Icon name="upload" />
          <strong>Drop a resume here, or choose a file</strong>
          <span className="muted">PDF, Word (.docx), an image or a text file, up to {maxMb} MB</span>
          <input ref={input} className="sr" type="file" disabled={!ai} accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,.txt"
                 onChange={(e) => read(e.target.files?.[0])} />
          <span className="btn primary" aria-hidden="true">Choose a file</span>
        </label>
        <p className="muted small">Many files at once? Use Bulk upload in the desktop app.</p>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="cols">
      <div className="stack">
        {error && <p className="notice bad" role="alert">{error}</p>}
        {dups.length > 0 && (
          <section className="panel card" data-testid="duplicates">
            <h2>{dups.length === 1 ? "This person may already be in the database" : "These people may already be in the database"}</h2>
            <p className="muted" style={{ marginBottom: 10 }}>The same file or the same email is already on a profile. Choose what to do with this resume.</p>
            <div className="stack" style={{ gap: 8 }}>
              {dups.map((d) => (
                <div key={d.id} className="stack" style={{ gap: 6 }}>
                  <label className="check"><input type="radio" name="choice" checked={choice === `update:${d.id}`} onChange={() => setChoice(`update:${d.id}`)} />
                    <span>Update <Link href={`/candidates/${d.id}`} target="_blank" style={{ fontWeight: 700 }}>{d.full_name}</Link>{d.current_title ? `, ${d.current_title}` : ""} with these details</span></label>
                  <label className="check"><input type="radio" name="choice" checked={choice === `attach:${d.id}`} onChange={() => setChoice(`attach:${d.id}`)} />
                    <span>Only add the file to {d.full_name}, and leave the profile as it is</span></label>
                </div>
              ))}
              <label className="check"><input type="radio" name="choice" checked={choice === "new"} onChange={() => setChoice("new")} /><span>Save as a new candidate anyway</span></label>
            </div>
          </section>
        )}
        <section className="panel card">
          <h2>Details read from the resume</h2>
          <div className="form-grid">
            {FIELDS.map(([k, label, o]) => (
              <div className={"field" + (o?.wide ? " wide" : "")} key={k}>
                <label htmlFor={k}>{label} {flag(k)}</label>
                <input className="input" id={k} type={o?.type || "text"} value={values[k] || ""} onChange={set(k)}
                       {...(o?.type === "number" ? { min: 0, max: 60, step: 0.5 } : {})} />
              </div>
            ))}
            <div className="field wide">
              <label htmlFor="skills">Skills {flag("skills")}</label>
              <input className="input" id="skills" value={values.skills || ""} onChange={set("skills")} />
              <span className="hint">Separated by commas</span>
            </div>
            <div className="field wide">
              <label htmlFor="summary">Summary {flag("summary")}</label>
              <textarea className="input" id="summary" rows={4} value={values.summary || ""} onChange={set("summary")} />
            </div>
            <div className="field"><label htmlFor="expected_salary">Expected salary</label>
              <input className="input" id="expected_salary" value={values.expected_salary || ""} onChange={set("expected_salary")} placeholder="If you know it" /></div>
            <div className="field"><label htmlFor="notice_period">Notice period</label>
              <input className="input" id="notice_period" value={values.notice_period || ""} onChange={set("notice_period")} placeholder="If you know it" /></div>
          </div>
        </section>
      </div>
      <div className="stack">
        <section className="panel card">
          <h2>File</h2>
          <p style={{ overflowWrap: "anywhere" }}>{file?.name}</p>
          <p className="muted small">{drive ? "Stored in Google Drive when you save." : "Google Drive is not set up here, so only the details are saved."}</p>
          <div className="form-actions" style={{ justifyContent: "flex-start", marginTop: 12 }}>
            <button className="btn primary" type="submit"><Icon name="check" />{choice.startsWith("attach") ? "Add the file" : choice.startsWith("update") ? "Update the profile" : "Save candidate"}</button>
            <button className="btn" type="button" onClick={() => { setStep("choose"); setFile(null); setError(""); }}>Start over</button>
          </div>
        </section>
        {(parsed.experience || []).length > 0 && (
          <section className="panel card">
            <h2>Job history {flag("experience")}</h2>
            <ul className="line-list">
              {parsed.experience.slice(0, 8).map((j: any, i: number) => (
                <li key={i} style={{ display: "block" }}><b>{j.job_title || "Role"}</b>{j.company ? `, ${j.company}` : ""}
                  <div className="muted small">{[j.start_date, j.end_date].filter(Boolean).join(" to ")}</div></li>
              ))}
            </ul>
          </section>
        )}
        {(parsed.education || []).length > 0 && (
          <section className="panel card">
            <h2>Education {flag("education")}</h2>
            <ul className="line-list">
              {parsed.education.map((e: any, i: number) => (
                <li key={i} style={{ display: "block" }}><b>{[e.degree, e.field_of_study].filter(Boolean).join(", ") || "Study"}</b>{e.institution ? `, ${e.institution}` : ""}{e.end_year ? `, ${e.end_year}` : ""}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </form>
  );
}
