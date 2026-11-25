"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Submit } from "@/components/client";
import { Icon } from "@/components/icons";
import type { Account, StageEdit } from "@/lib/admin";
import { checkAction, createUserAction, saveStagesAction, updateUserAction, type Result } from "./actions";

function useToast() {
  const [toast, setToast] = useState("");
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 5000); return () => clearTimeout(t); }, [toast]);
  return [toast, setToast] as const;
}

export function Users({ users, me }: { users: Account[]; me: string }) {
  const [toast, setToast] = useToast();
  const [pending, start] = useTransition();
  const [state, action] = useActionState<Result, FormData>(createUserAction, { ok: true, message: "" });
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok && state.message) form.current?.reset(); }, [state]);
  const change = (id: string, c: { active?: boolean; user_type?: string }) =>
    start(async () => { const out = await updateUserAction(id, c); setToast(out.ok ? "Saved" : out.message); });
  return (
    <section className="panel card">
      <h2>Users</h2>
      <p className="muted" style={{ marginBottom: 8 }}>A new account has no access until it is switched on. The same accounts work in the desktop app.</p>
      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead><tr><th>Name</th><th className="hide-sm">Email</th><th>Type</th><th>Switched on</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} data-user={u.email}>
                <td style={{ fontWeight: 600 }}>{u.full_name || "No name"}{u.id === me ? <span className="muted small"> (you)</span> : null}
                  <div className="muted small only-sm" style={{ fontWeight: 400, overflowWrap: "anywhere" }}>{u.email}</div></td>
                <td className="muted hide-sm">{u.email}</td>
                <td>
                  <select className="input" value={u.user_type} disabled={pending || u.id === me} aria-label={`Type of account for ${u.email}`}
                          onChange={(e) => change(u.id, { user_type: e.target.value })}>
                    <option value="consultant">Consultant</option><option value="admin">Admin</option>
                  </select>
                </td>
                <td>
                  <label className="check"><input type="checkbox" checked={u.active} disabled={pending || u.id === me}
                         onChange={(e) => change(u.id, { active: e.target.checked })} aria-label={`${u.email} switched on`} />{u.active ? "On" : "Off"}</label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 style={{ margin: "18px 0 8px" }}>Add a user</h2>
      <form ref={form} action={action} className="form-grid">
        <div className="field"><label htmlFor="u-name">Name</label><input className="input" id="u-name" name="name" required /></div>
        <div className="field"><label htmlFor="u-email">Email</label><input className="input" id="u-email" name="email" type="email" required /></div>
        <div className="field"><label htmlFor="u-password">Password to start with</label>
          <input className="input" id="u-password" name="password" type="text" minLength={8} required autoComplete="off" />
          <span className="hint">At least 8 characters. Give it to the person yourself.</span></div>
        <div className="field" style={{ alignContent: "end" }}>
          <label className="check"><input type="checkbox" name="on" value="1" defaultChecked />Switch on straight away</label>
          <div><Submit busy="Adding…" className="btn"><Icon name="plus" />Add user</Submit></div>
        </div>
      </form>
      {state.message && <p className={"notice " + (state.ok ? "good" : "bad")} role="status" style={{ marginTop: 12 }}>{state.message}</p>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </section>
  );
}

export function Stages({ stages }: { stages: { id: string; name: string; color: string | null }[] }) {
  const [rows, setRows] = useState<(StageEdit & { key: string })[]>(stages.map((s) => ({ id: s.id, key: s.id, name: s.name, color: s.color || "#6B6660" })));
  const [note, setNote] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const set = (key: string, change: Partial<StageEdit>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const move = (i: number, by: number) => {
    const next = [...rows]; const j = i + by;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]]; setRows(next);
  };
  function save() {
    const removed = stages.filter((s) => !rows.some((r) => r.id === s.id)).map((s) => s.name);
    if (removed.length && !window.confirm(`Remove the stage${removed.length > 1 ? "s" : ""} ${removed.join(", ")}?\n\nCandidates at ${removed.length > 1 ? "those stages" : "that stage"} stay in their roles, with no stage.`)) return;
    start(async () => setNote(await saveStagesAction(rows.map(({ id, name, color }) => ({ id, name, color })))));
  }
  return (
    <section className="panel card">
      <h2>Stages</h2>
      <p className="muted" style={{ marginBottom: 10 }}>The steps a candidate moves through inside a role, in this order.</p>
      <div className="stack" style={{ gap: 8 }}>
        {rows.map((r, i) => (
          <div className="stage-edit" key={r.key}>
            <input type="color" value={r.color} onChange={(e) => set(r.key, { color: e.target.value })} aria-label={`Colour of ${r.name || "the new stage"}`} />
            <input className="input" value={r.name} onChange={(e) => set(r.key, { name: e.target.value })} placeholder="Stage name" aria-label="Stage name" maxLength={40} />
            <span style={{ display: "flex", gap: 4 }}>
              <button type="button" className="btn small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" style={{ padding: "0 8px" }}>↑</button>
              <button type="button" className="btn small" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down" style={{ padding: "0 8px" }}>↓</button>
            </span>
            <button type="button" className="btn quiet small" onClick={() => setRows(rows.filter((x) => x.key !== r.key))} aria-label={`Remove ${r.name || "this stage"}`}><Icon name="trash" /></button>
          </div>
        ))}
      </div>
      <div className="form-actions" style={{ justifyContent: "space-between" }}>
        <button type="button" className="btn quiet" onClick={() => setRows([...rows, { key: "new" + Date.now(), name: "", color: "#0E7C83" }])}><Icon name="plus" />Add stage</button>
        <button type="button" className="btn primary" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save stages"}</button>
      </div>
      {note && <p className={"notice " + (note.ok ? "good" : "bad")} role="status" style={{ marginTop: 12 }}>{note.message}</p>}
    </section>
  );
}

export function Connections({ items }: { items: { kind: string; title: string; ready: boolean; what: string; missing: string }[] }) {
  const [notes, setNotes] = useState<Record<string, Result>>({});
  const [busy, setBusy] = useState("");
  async function check(kind: string) {
    setBusy(kind);
    const out = await checkAction(kind);
    setNotes((n) => ({ ...n, [kind]: out }));
    setBusy("");
  }
  return (
    <section className="panel card">
      <h2>Connections</h2>
      <p className="muted" style={{ marginBottom: 6 }}>These keys are set on the web host, not here, and are never shown in the browser.</p>
      {items.map((c) => (
        <div key={c.kind}>
          <div className="check-row">
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{c.title} <span className={"tag " + (c.ready ? "good" : "warn")}>{c.ready ? "Key is set" : "Not set"}</span></div>
              <div className="muted small">{c.ready ? c.what : c.missing}</div>
            </div>
            <button type="button" className="btn small" disabled={!c.ready || busy === c.kind} onClick={() => check(c.kind)}>{busy === c.kind ? "Checking…" : "Test"}</button>
          </div>
          {notes[c.kind] && <p className={"notice " + (notes[c.kind].ok ? "good" : "bad")} role="status" data-check={c.kind} style={{ marginBottom: 10 }}>{notes[c.kind].message}</p>}
        </div>
      ))}
    </section>
  );
}
