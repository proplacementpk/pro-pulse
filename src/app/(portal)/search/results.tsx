"use client";
/** The result list: ticks that survive paging, "select all", and adding the ticked people to a role. */
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { ShareMenu, type Team } from "@/components/share";
import { plural, years } from "@/lib/format";
import type { Hit } from "@/lib/data";
import type { Raw } from "@/lib/search";
import { addToRoleAction, selectAllAction } from "./actions";

type RoleOption = { id: string; title: string };

export function Results({ rows, total, words, roles, searchKey, params, isAdmin, ownEmail, team, canEmail }: {
  rows: Hit[]; total: number; words: string[]; roles: RoleOption[]; searchKey: string; params: Raw;
  isAdmin: boolean; ownEmail: string; team: Team; canEmail: boolean;
}) {
  const store = "pp_sel:" + searchKey;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [role, setRole] = useState(roles[0]?.id || "");
  const [toast, setToast] = useState("");
  const [pending, start] = useTransition();

  // ticks are kept while the same search is paged through, and forgotten for a new search
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(store) || "[]");
      setSelected(new Set(Array.isArray(saved) ? saved : []));
    } catch { setSelected(new Set()); }
  }, [store]);

  function keep(next: Set<string>) {
    setSelected(next);
    try {
      for (const k of Object.keys(sessionStorage)) if (k.startsWith("pp_sel:") && k !== store) sessionStorage.removeItem(k);
      sessionStorage.setItem(store, JSON.stringify([...next]));
    } catch { /* private browsing: ticks then last for this page only */ }
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const onPage = useMemo(() => rows.filter((r) => selected.has(r.id)).length, [rows, selected]);
  const allOnPage = rows.length > 0 && onPage === rows.length;

  function toggle(id: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(id); else next.delete(id);
    keep(next);
  }
  function togglePage(on: boolean) {
    const next = new Set(selected);
    for (const r of rows) { if (on) next.add(r.id); else next.delete(r.id); }
    keep(next);
  }
  function selectEverything() {
    start(async () => {
      const out = await selectAllAction(params);
      if (out.ok && out.ids) keep(new Set(out.ids)); else setToast(out.message);
    });
  }
  function add(ids: string[]) {
    const title = roles.find((r) => r.id === role)?.title || "";
    start(async () => setToast((await addToRoleAction(role, title, ids)).message));
  }

  const hit = (skill: string) => words.some((w) => skill.toLowerCase().includes(w));

  return (
    <div className="panel">
      <div className="bar">
        <label className="check">
          <input type="checkbox" checked={allOnPage} onChange={(e) => togglePage(e.target.checked)} aria-label="Select everyone on this page" />
          <span>Select page</span>
        </label>
        {selected.size > 0 && <span className="selected" data-testid="selected">{selected.size.toLocaleString("en")} selected</span>}
        {total > rows.length && selected.size < total && (
          <button type="button" className="btn quiet small" onClick={selectEverything} disabled={pending}>Select all {total.toLocaleString("en")}</button>
        )}
        {selected.size > 0 && (
          <button type="button" className="btn quiet small" onClick={() => keep(new Set())}><Icon name="x" />Clear selection</button>
        )}
        <span className="spacer" />
        {roles.length ? (
          <>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role to add candidates to">
              {roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
            <button type="button" className="btn primary small" disabled={pending || !selected.size} onClick={() => add([...selected])}>
              <Icon name="plus" />Add to role
            </button>
          </>
        ) : <span className="muted small">No open roles yet</span>}
        <ShareMenu count={selected.size || total} isAdmin={isAdmin} ownEmail={ownEmail} team={team} canEmail={canEmail} title="Propulse search"
                   request={() => ({ kind: "search", ids: [...selected], params })} />
      </div>
      <ul className="rows">
        {rows.map((r) => {
          const skills = r.skills || [];
          const shown = [...skills.filter(hit), ...skills.filter((s) => !hit(s))].slice(0, 4);
          return (
            <li key={r.id} className={"row" + (selected.has(r.id) ? " on" : "")}>
              <input type="checkbox" checked={selected.has(r.id)} onChange={(e) => toggle(r.id, e.target.checked)} aria-label={`Select ${r.full_name}`} />
              <div style={{ minWidth: 0 }}>
                <div className="who-line">
                  <Link className="name" href={`/candidates/${r.id}`}>{r.full_name}</Link>
                  {r.review_status === "Unreviewed" && <span className="tag warn" title="Nobody has checked this profile yet">Unreviewed</span>}
                  {r.candidate_status && r.candidate_status !== "Active" && <span className={"tag " + (r.candidate_status === "Do not contact" ? "bad" : "good")}>{r.candidate_status}</span>}
                </div>
                <div className="job">{[r.current_title, r.current_company].filter(Boolean).join(" at ") || "No current role recorded"}</div>
              </div>
              <div className="facts">
                {r.total_experience_years !== null && <div><b>{years(r.total_experience_years)}</b></div>}
                <div>{r.city || ""}</div>
              </div>
              <div className="tags">
                {shown.map((s) => <span key={s} className={"tag" + (hit(s) ? " hit" : "")}>{s}</span>)}
                {skills.length > shown.length && <span className="tag" title={skills.slice(shown.length).join(", ")}>+{skills.length - shown.length}</span>}
              </div>
              <div className="flags">
                {r.match ? <span className="small muted nowrap" title="How this profile was found">{r.match}</span> : null}
              </div>
            </li>
          );
        })}
      </ul>
      {toast && <div className="toast" role="status">{toast}</div>}
      <span className="sr" aria-live="polite">{selected.size ? plural(selected.size, "candidate") + " selected" : ""}</span>
    </div>
  );
}
