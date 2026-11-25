"use client";
/** Inside a role: who is at which stage, moving people along, notes for this role, and export. */
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { ShareMenu, type Team } from "@/components/share";
import type { Stage } from "@/lib/data";
import { niceDate } from "@/lib/format";
import type { Member } from "@/lib/roles";
import { deleteRoleAction, removeAction, roleNoteAction, setStageAction } from "../actions";

type Notes = Record<string, { id: string; body: string; author_name: string | null; created_at: string }[]>;

export function RoleBoard({ role, members, notes, stages, isAdmin, ownEmail, team, canEmail }: {
  role: { id: string; title: string }; members: Member[]; notes: Notes; stages: Stage[];
  isAdmin: boolean; ownEmail: string; team: Team; canEmail: boolean;
}) {
  const every = useMemo(() => [...stages.map((s) => s.id), "none"], [stages]);
  const [shown, setShown] = useState<Set<string>>(new Set(every));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string>("");
  const [moveTo, setMoveTo] = useState(stages[0]?.id || "");
  const [toast, setToast] = useState("");
  const [menu, setMenu] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 4500); return () => clearTimeout(t); }, [toast]);
  // people who left the role (or were moved) are no longer ticked
  useEffect(() => { setSelected((s) => new Set([...s].filter((id) => members.some((m) => m.rc_id === id)))); }, [members]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of members) c[m.stage_id || "none"] = (c[m.stage_id || "none"] || 0) + 1;
    return c;
  }, [members]);
  const visible = members.filter((m) => shown.has(m.stage_id || "none"));
  const ticked = visible.filter((m) => selected.has(m.rc_id));
  const stageName = (id: string) => stages.find((s) => s.id === id)?.name || "";
  const run = (job: () => Promise<{ ok: boolean; message: string }>, then?: () => void) =>
    start(async () => {
      const out = await job();
      if (!out) return; // the action moved to another page
      setToast(out.message);
      if (out.ok && then) then();
    });

  function toggleStage(id: string) {
    const next = new Set(shown);
    if (next.has(id)) next.delete(id); else next.add(id);
    setShown(next);
  }
  function tick(id: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(id); else next.delete(id);
    setSelected(next);
  }
  function move(ids: string[], stageId: string) {
    if (!ids.length) return setToast("Tick one or more candidates first.");
    run(() => setStageAction(role.id, ids, stageId, stageName(stageId)));
  }
  function remove() {
    if (!ticked.length) return setToast("Tick one or more candidates first.");
    if (!window.confirm(`Take ${ticked.length} candidate${ticked.length === 1 ? "" : "s"} out of this role? They stay in the database.`)) return;
    run(() => removeAction(role.id, ticked.map((m) => m.rc_id)), () => setSelected(new Set()));
  }
  function deleteRole() {
    setMenu(false);
    const n = members.length;
    if (!window.confirm(`Delete the role "${role.title}"? This cannot be undone.\n\n` +
      (n ? `Its ${n} candidate${n === 1 ? "" : "s"} stay in the database and only leave this role. ` : "") +
      "Notes written in this role stay on the candidates' profiles.")) return;
    run(() => deleteRoleAction(role.id));
  }
  function saveNote(e: React.FormEvent<HTMLFormElement>, candidateId: string) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = String(new FormData(form).get("body") || "");
    run(() => roleNoteAction(role.id, candidateId, body), () => form.reset());
  }

  const allShown = every.every((id) => shown.has(id));

  return (
    <div className="panel">
      <div className="toggles" aria-label="Stages to list and export">
        <button type="button" className="toggle" aria-pressed={allShown} onClick={() => setShown(new Set(allShown ? [] : every))}>All stages <b>{members.length}</b></button>
        {stages.map((s) => (
          <button type="button" key={s.id} className="toggle" aria-pressed={shown.has(s.id)} onClick={() => toggleStage(s.id)}>
            <i style={{ background: s.color || "#888" }} />{s.name} <b>{counts[s.id] || 0}</b>
          </button>
        ))}
        {counts.none ? <button type="button" className="toggle" aria-pressed={shown.has("none")} onClick={() => toggleStage("none")}>No stage <b>{counts.none}</b></button> : null}
      </div>
      <div className="bar">
        <label className="check">
          <input type="checkbox" checked={visible.length > 0 && ticked.length === visible.length} aria-label="Select everyone listed"
                 onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((m) => m.rc_id)) : new Set())} />
          <span>Select all</span>
        </label>
        {ticked.length > 0 && <span className="selected" data-testid="selected">{ticked.length} selected</span>}
        {ticked.length > 0 && <button type="button" className="btn quiet small" onClick={() => setSelected(new Set())}><Icon name="x" />Clear selection</button>}
        <span className="spacer" />
        <select className="input" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label="Stage to move the ticked candidates to">
          {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button type="button" className="btn primary small" disabled={pending || !ticked.length} onClick={() => move(ticked.map((m) => m.rc_id), moveTo)}>Move</button>
        <button type="button" className="btn small" disabled={pending || !ticked.length} onClick={remove} title="Take the ticked candidates out of this role. They stay in the database.">Remove</button>
        <ShareMenu count={ticked.length || visible.length} isAdmin={isAdmin} ownEmail={ownEmail} team={team} canEmail={canEmail} inRole title={role.title}
                   request={() => ({ kind: "role", role: role.id, stages: allShown ? [] : [...shown], ids: ticked.map((m) => m.candidate_id) })} />
        {isAdmin && (
          <div className="menu-box">
            <button type="button" className="btn small" aria-label="More: delete this role" aria-expanded={menu} onClick={() => setMenu(!menu)}><Icon name="more" /></button>
            {menu && <div className="menu" role="menu"><button type="button" role="menuitem" className="danger" onClick={deleteRole}>Delete this role…</button></div>}
          </div>
        )}
      </div>
      {visible.map((m) => {
        const mine = notes[m.candidate_id] || [];
        return (
          <div key={m.rc_id} className={"member" + (selected.has(m.rc_id) ? " on" : "")}>
            <input type="checkbox" checked={selected.has(m.rc_id)} onChange={(e) => tick(m.rc_id, e.target.checked)} aria-label={`Select ${m.full_name}`} />
            <div style={{ minWidth: 0 }}>
              <Link className="name" href={`/candidates/${m.candidate_id}`}>{m.full_name}</Link>
              {m.review_status === "Unreviewed" && <span className="tag warn" style={{ marginLeft: 8 }}>Unreviewed</span>}
              <div className="muted small">{[m.current_title, m.current_company].filter(Boolean).join(" at ")}</div>
            </div>
            <div className="muted small">
              <div>{m.city || ""}</div>
              {m.stage_changed_by_name && <div title="Who last changed the stage, and when">{m.stage_changed_by_name}, {niceDate(m.stage_changed_at)}</div>}
            </div>
            <select className="input" value={m.stage_id || ""} disabled={pending} aria-label={`Stage of ${m.full_name}`}
                    onChange={(e) => move([m.rc_id], e.target.value)}>
              {!m.stage_id && <option value="">No stage</option>}
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button type="button" className="btn quiet small" aria-expanded={open === m.rc_id} onClick={() => setOpen(open === m.rc_id ? "" : m.rc_id)}>
              <Icon name="note" />Notes{mine.length ? ` (${mine.length})` : ""}
            </button>
            {open === m.rc_id && (
              <div className="member-notes">
                {mine.map((n) => (
                  <div key={n.id}><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{n.body}</p>
                    <div className="muted small">{n.author_name || "Someone"}, {niceDate(n.created_at, true)}</div></div>
                ))}
                <form onSubmit={(e) => saveNote(e, m.candidate_id)} className="inline-form" style={{ alignItems: "flex-start" }}>
                  <textarea className="input" name="body" rows={2} placeholder={`A note about ${m.full_name} for this role`} aria-label="New note for this role" required style={{ flex: 1, minWidth: 220 }} />
                  <button className="btn small" type="submit" disabled={pending}><Icon name="check" />Save note</button>
                </form>
              </div>
            )}
          </div>
        );
      })}
      {!visible.length && (
        <div className="members-empty">{members.length ? "No candidates in the stages you chose." : "No candidates yet. Add them from Search."}</div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
