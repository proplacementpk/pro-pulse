"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Submit } from "@/components/client";
import { saveRoleAction, type State } from "./actions";

type Values = { id?: string; title?: string; department?: string | null; location?: string | null; status?: string;
                description?: string | null; assigned_to?: string | null; assigned_name?: string | null };

export function RoleForm({ role, people }: { role: Values; people: { id: string; full_name: string | null; email: string; user_type: string }[] }) {
  const [state, action] = useActionState<State, FormData>(saveRoleAction, {});
  const gone = role.assigned_to && !people.some((p) => p.id === role.assigned_to);
  return (
    <form action={action} className="panel card" style={{ maxWidth: 760 }}>
      {role.id && <input type="hidden" name="id" value={role.id} />}
      {state.error && <p className="notice bad" role="alert" style={{ marginBottom: 14 }}>{state.error}</p>}
      <div className="form-grid">
        <div className="field wide"><label htmlFor="title">Role title</label>
          <input className="input" id="title" name="title" defaultValue={role.title || ""} required autoFocus={!role.id} /></div>
        <div className="field"><label htmlFor="department">Client or department</label>
          <input className="input" id="department" name="department" defaultValue={role.department || ""} /></div>
        <div className="field"><label htmlFor="location">Location</label>
          <input className="input" id="location" name="location" defaultValue={role.location || ""} /></div>
        <div className="field"><label htmlFor="assigned_to">Consultant</label>
          <select className="input" id="assigned_to" name="assigned_to" defaultValue={role.assigned_to || ""}>
            <option value="">Not assigned</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}{p.user_type === "admin" ? " (admin)" : ""}</option>)}
            {gone && <option value={role.assigned_to!}>{role.assigned_name || "Former user"} (switched off)</option>}
          </select>
          <span className="hint">Who works this role. Everyone can still see it.</span></div>
        <div className="field"><label htmlFor="status">Status</label>
          <select className="input" id="status" name="status" defaultValue={role.status || "Open"}>
            <option>Open</option><option>On hold</option><option>Closed</option>
          </select></div>
        <div className="field wide"><label htmlFor="description">Job description</label>
          <textarea className="input" id="description" name="description" rows={7} defaultValue={role.description || ""} /></div>
      </div>
      <div className="form-actions">
        <Link className="btn" href={role.id ? `/roles/${role.id}` : "/roles"}>Cancel</Link>
        <Submit busy="Saving…">{role.id ? "Save role" : "Create role"}</Submit>
      </div>
    </form>
  );
}
