"use client";
/** The Export button: an Excel sheet, a sheet with chosen columns, or the list sent by email. */
import { useEffect, useRef, useState, useTransition } from "react";
import { DEFAULT_EXPORT, EXPORT_COLUMNS } from "@/lib/columns";
import type { ShareRequest } from "@/lib/share";
import { emailListAction } from "@/app/(portal)/share-actions";
import { Icon } from "./icons";

export type Team = { name: string; email: string }[];

export function ShareMenu({ request, count, isAdmin, ownEmail, team, canEmail, inRole = false, title }: {
  request: () => ShareRequest; count: number; isAdmin: boolean; ownEmail: string; team: Team; canEmail: boolean; inRole?: boolean; title: string;
}) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<"" | "columns" | "email">("");
  const [columns, setColumns] = useState<string[]>(DEFAULT_EXPORT);
  const [note, setNote] = useState("");        // shown as a toast after something worked
  const [problem, setProblem] = useState("");  // shown inside the open dialog
  const [busy, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const modal = useRef<HTMLDialogElement>(null);
  const [to, setTo] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("pp_columns") || "null");
      if (Array.isArray(saved) && saved.length) setColumns(saved);
    } catch { /* keep the standard columns */ }
  }, []);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  useEffect(() => {
    setProblem("");
    if (dialog) setNote("");
    if (dialog && modal.current && !modal.current.open) modal.current.showModal();
    if (!dialog && modal.current?.open) modal.current.close();
  }, [dialog]);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(""), 5000); return () => clearTimeout(t); }, [note]);

  function download(cols: string[] | null) {
    setOpen(false);
    start(async () => {
      try {
        const res = await fetch("/api/export", { method: "POST", headers: { "Content-Type": "application/json" },
                                                 body: JSON.stringify({ ...request(), columns: cols }) });
        if (!res.ok) throw new Error((await res.json()).error || "The sheet could not be made.");
        const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || "Candidates.xlsx";
        const url = URL.createObjectURL(await res.blob());
        const a = document.createElement("a");
        a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        setNote(`Sheet downloaded: ${res.headers.get("X-Rows")} candidates`);
        setDialog("");
      } catch (e) {
        const text = e instanceof Error ? e.message : "The sheet could not be made.";
        if (dialog) setProblem(text); else setNote(text);
      }
    });
  }

  function chooseColumns(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const picked = new FormData(e.currentTarget).getAll("col").map(String);
    if (!picked.length) return setProblem("Tick at least one column.");
    setColumns(picked);
    try { localStorage.setItem("pp_columns", JSON.stringify(picked)); } catch { /* not remembered, still used now */ }
    download(picked);
  }

  function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const others = String(form.get("others") || "");
    const all = [...to, others].filter(Boolean).join(", ");
    start(async () => {
      const out = await emailListAction(request(), all, String(form.get("subject") || ""), String(form.get("message") || ""));
      if (out.ok) { setDialog(""); setNote(out.message); } else setProblem(out.message);
    });
  }

  const ticked = inRole && !columns.includes("stage") ? [...columns, "stage"] : columns;

  return (
    <div className="menu-box" ref={box}>
      <button type="button" className="btn small" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} disabled={busy || !count}>
        <Icon name="download" />{busy ? "Working…" : "Export"}
      </button>
      {open && (
        <div className="menu" role="menu">
          <button type="button" role="menuitem" onClick={() => download(null)}>Excel sheet</button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); setDialog("columns"); }}>Choose columns…</button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); setDialog("email"); }}>Email this list…</button>
        </div>
      )}
      <dialog ref={modal} className="dialog" onClose={() => setDialog("")}>
        {dialog === "columns" && (
          <form onSubmit={chooseColumns}>
            <h2>Choose columns</h2>
            <p className="muted">Your choice is remembered in this browser.</p>
            <div className="col-grid">
              {EXPORT_COLUMNS.map(([k, label]) => (
                <label className="check" key={k}><input type="checkbox" name="col" value={k} defaultChecked={ticked.includes(k)} />{label}</label>
              ))}
            </div>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setDialog("")}>Cancel</button>
              <button type="submit" className="btn primary" disabled={busy}>Download sheet</button>
            </div>
          </form>
        )}
        {dialog === "email" && (
          <form onSubmit={send}>
            <h2>Email this list</h2>
            <p className="muted small" style={{ marginBottom: 6 }}>{count === 1 ? "1 candidate goes" : `${count.toLocaleString("en")} candidates go`} in the sheet.</p>
            {!canEmail ? <p className="notice warn">Email is not set up on the web portal yet. An admin adds the Brevo key on the host.</p>
              : isAdmin ? (
                <>
                  <p className="muted">Tick who gets the sheet, or type other addresses.</p>
                  <div className="col-grid">
                    {team.map((p) => (
                      <label className="check" key={p.email}>
                        <input type="checkbox" checked={to.includes(p.email)} onChange={(e) => setTo(e.target.checked ? [...to, p.email] : to.filter((x) => x !== p.email))} />
                        <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{p.name}</span>
                      </label>
                    ))}
                  </div>
                  <div className="field" style={{ marginTop: 10 }}>
                    <label htmlFor="others">Other addresses</label>
                    <input className="input" id="others" name="others" placeholder="name@company.com, another@company.com" />
                  </div>
                </>
              ) : <p className="muted">The sheet is sent to your own address, {ownEmail}.</p>}
            <div className="field" style={{ marginTop: 10 }}>
              <label htmlFor="subject">Subject</label>
              <input className="input" id="subject" name="subject" defaultValue={title} />
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <label htmlFor="message">Message</label>
              <textarea className="input" id="message" name="message" rows={3} placeholder="A line to go with the sheet" />
            </div>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setDialog("")}>Cancel</button>
              <button type="submit" className="btn primary" disabled={busy || !canEmail}>{busy ? "Sending…" : "Send"}</button>
            </div>
          </form>
        )}
        {problem && dialog && <p className="notice bad" role="alert" style={{ marginTop: 10 }}>{problem}</p>}
      </dialog>
      {note && !dialog && <div className="toast" role="status">{note}</div>}
    </div>
  );
}
