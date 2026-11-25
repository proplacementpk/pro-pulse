import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { stages as loadStages } from "@/lib/data";
import { niceDate, plural } from "@/lib/format";
import { listRoles } from "@/lib/roles";
import { requireUser } from "@/lib/user";

export const metadata: Metadata = { title: "Roles" };

const WHOSE: [string, string][] = [["", "Everyone's roles"], ["mine", "My roles"], ["none", "Not assigned"]];
const STATUS = ["Open", "On hold", "Closed"];

export default async function RolesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const [all, stages] = await Promise.all([listRoles(user), loadStages(user)]);
  const whose = sp.whose === "mine" || sp.whose === "none" ? sp.whose : "";
  const status = STATUS.includes(sp.status || "") ? sp.status! : "";
  const q = (sp.q || "").trim().toLowerCase();
  const roles = all.filter((r) =>
    (!status || r.status === status) &&
    (!whose || (whose === "mine" ? r.assigned_to === user.uid : !r.assigned_to)) &&
    (!q || [r.title, r.department, r.location, r.assigned_name].join(" ").toLowerCase().includes(q)));
  const href = (change: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: sp.q || "", whose, status, ...change })) if (v) p.set(k, v);
    const text = p.toString();
    return text ? `/roles?${text}` : "/roles";
  };
  const inAll = roles.reduce((n, r) => n + r.total, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Roles</h1>
          <p className="sub">Open positions, who is working them, and the candidates being considered for each.</p>
        </div>
        <Link className="btn primary" href="/roles/new"><Icon name="plus" />Add role</Link>
      </div>
      {sp.deleted && <p className="notice good" role="status" style={{ marginBottom: 12 }}>Role deleted. Its candidates are still in the database.</p>}
      <form className="query" action="/roles" style={{ marginBottom: 10 }}>
        <input className="input" name="q" defaultValue={sp.q || ""} placeholder="Find a role by title, client, location or consultant" aria-label="Find a role" style={{ height: 40, fontSize: 14.5 }} />
        {whose && <input type="hidden" name="whose" value={whose} />}
        {status && <input type="hidden" name="status" value={status} />}
        <button className="btn" type="submit" style={{ height: 40 }}><Icon name="search" /><span>Find</span></button>
      </form>
      <div className="chips">
        {WHOSE.map(([k, label]) => <Link key={k} className="toggle" aria-pressed={whose === k} href={href({ whose: k })}>{label}</Link>)}
        <span style={{ width: 10 }} />
        <Link className="toggle" aria-pressed={!status} href={href({ status: "" })}>All statuses</Link>
        {STATUS.map((s) => <Link key={s} className="toggle" aria-pressed={status === s} href={href({ status: s })}>{s}</Link>)}
      </div>
      <p className="muted" style={{ margin: "4px 0 10px" }} data-testid="roles-total">{plural(roles.length, "role")}, {plural(inAll, "candidate")} in them</p>
      {roles.length ? (
        <div className="panel">
          {roles.map((r) => (
            <div className="role-row" key={r.id}>
              <div style={{ minWidth: 0 }}>
                <Link className="title" href={`/roles/${r.id}`}>{r.title}</Link>
                <div className="muted small">{[r.department, r.location, "opened " + niceDate(r.created_at)].filter(Boolean).join(", ")}</div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="muted small">Consultant</div>
                <div style={{ fontWeight: r.assigned_name ? 600 : 400 }} className={r.assigned_name ? "" : "muted"}>{r.assigned_name || "Not assigned"}</div>
              </div>
              <div className="tags">
                {stages.filter((s) => r.counts[s.id]).map((s) => (
                  <span className="stage-tag" key={s.id}><i style={{ background: s.color || "#888" }} />{s.name} <b>{r.counts[s.id]}</b></span>
                ))}
                {!r.total && <span className="muted small">No candidates yet</span>}
              </div>
              <div className="num" title="Candidates in this role">{r.total}</div>
              <div style={{ textAlign: "right" }}><span className={"tag " + (r.status === "Open" ? "good" : r.status === "On hold" ? "warn" : "")}>{r.status}</span></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel empty">
          <h2>{all.length ? "No roles match" : "No roles yet"}</h2>
          <p>{all.length ? "Change the choices above to see more roles." : "Add a role, then add candidates to it from Search."}</p>
        </div>
      )}
    </>
  );
}
