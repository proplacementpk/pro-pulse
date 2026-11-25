"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Submit } from "@/components/client";
import { saveCandidateAction, type State } from "../../actions";

type Values = Record<string, string>;

export function EditForm({ id, values, statuses }: { id: string; values: Values; statuses: string[] }) {
  const [state, action] = useActionState<State, FormData>(saveCandidateAction, {});
  const box = (name: string, label: string, opts: { type?: string; wide?: boolean; hint?: string; required?: boolean } = {}) => (
    <div className={"field" + (opts.wide ? " wide" : "")}>
      <label htmlFor={name}>{label}</label>
      <input className="input" id={name} name={name} type={opts.type || "text"} defaultValue={values[name] || ""} required={opts.required}
             {...(opts.type === "number" ? { min: 0, max: 60, step: 0.5 } : {})} />
      {opts.hint && <span className="hint">{opts.hint}</span>}
    </div>
  );
  return (
    <form action={action} className="panel card">
      <input type="hidden" name="candidate" value={id} />
      {state.error && <p className="notice bad" role="alert" style={{ marginBottom: 14 }}>{state.error}</p>}
      <div className="form-grid">
        {box("full_name", "Full name", { required: true })}
        <div className="field">
          <label htmlFor="candidate_status">Status</label>
          <select className="input" id="candidate_status" name="candidate_status" defaultValue={values.candidate_status || "Active"}>
            {statuses.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        {box("current_title", "Current title")}
        {box("current_company", "Current company")}
        {box("total_experience_years", "Experience, in years", { type: "number" })}
        {box("highest_education", "Highest education")}
        {box("email", "Email", { type: "email" })}
        {box("alternate_email", "Second email", { type: "email" })}
        {box("phone", "Phone")}
        {box("alternate_phone", "Second phone")}
        {box("city", "City")}
        {box("country", "Country")}
        {box("linkedin_url", "LinkedIn", { wide: true })}
        {box("current_salary", "Current salary")}
        {box("expected_salary", "Expected salary")}
        {box("notice_period", "Notice period")}
        {box("benefits", "Benefits")}
        {box("skills", "Skills", { wide: true, hint: "Separated by commas" })}
        <div className="field wide">
          <label htmlFor="summary">Summary</label>
          <textarea className="input" id="summary" name="summary" rows={5} defaultValue={values.summary || ""} />
        </div>
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>Job history, education and certifications are edited in the desktop app.</p>
      <div className="form-actions">
        <Link className="btn" href={`/candidates/${id}`}>Cancel</Link>
        <Submit busy="Saving…">Save changes</Submit>
      </div>
    </form>
  );
}
