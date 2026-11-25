"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Submit } from "@/components/client";
import { Icon } from "@/components/icons";
import { addNoteAction, addToRoleFromProfile, deleteCandidateAction, type State } from "../actions";

export function NoteForm({ candidate }: { candidate: string }) {
  const [state, action] = useActionState<State, FormData>(addNoteAction, {});
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (state.ok && box.current) box.current.value = ""; }, [state]);
  return (
    <form action={action} className="stack" style={{ gap: 8 }}>
      <input type="hidden" name="candidate" value={candidate} />
      <textarea ref={box} className="input" name="body" rows={3} placeholder="Add a note: a call, salary expectation, availability" aria-label="New note" required />
      {state.error && <p className="notice bad" role="alert">{state.error}</p>}
      <div><Submit className="btn" busy="Saving…"><Icon name="check" />Save note</Submit></div>
    </form>
  );
}

export function RoleForm({ candidate, roles }: { candidate: string; roles: { id: string; title: string }[] }) {
  const [state, action] = useActionState<State, FormData>(addToRoleFromProfile, {});
  if (!roles.length) return <p className="muted small">In every open role already, or there are no open roles.</p>;
  return (
    <form action={action} className="stack" style={{ gap: 8 }}>
      <input type="hidden" name="candidate" value={candidate} />
      <div className="inline-form">
        <select className="input" name="role" aria-label="Role to add this candidate to" defaultValue={roles[0].id}>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
        </select>
        <Submit className="btn" busy="Adding…"><Icon name="plus" />Add to role</Submit>
      </div>
      {state.error && <p className="notice bad" role="alert">{state.error}</p>}
      {state.ok && <p className="notice good" role="status">{state.ok}</p>}
    </form>
  );
}

/** Admins only: Delete sits in its own menu, away from Edit. */
export function MoreMenu({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  function remove() {
    setOpen(false);
    if (!window.confirm(`Delete ${name} for good: the profile, notes and places in roles?\n\nThis cannot be undone. Resume files stay in Google Drive.`)) return;
    start(async () => { const out = await deleteCandidateAction(id); if (out?.error) setError(out.error); });
  }
  return (
    <div className="menu-box">
      <button type="button" className="btn" aria-label="More: delete this candidate" aria-expanded={open} disabled={pending} onClick={() => setOpen(!open)}><Icon name="more" /></button>
      {open && <div className="menu" role="menu"><button type="button" role="menuitem" className="danger" onClick={remove}>Delete this candidate…</button></div>}
      {error && <div className="toast" role="alert">{error}</div>}
    </div>
  );
}
