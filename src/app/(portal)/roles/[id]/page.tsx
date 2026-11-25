import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { emailReady } from "@/lib/brevo";
import { stages as loadStages } from "@/lib/data";
import { plural } from "@/lib/format";
import { getRole, people } from "@/lib/roles";
import { requireUser } from "@/lib/user";
import { RoleBoard } from "./board";

export const metadata: Metadata = { title: "Role" };

export default async function RolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [found, stages] = await Promise.all([getRole(user, id), loadStages(user)]);
  if (!found) notFound();
  const { role, members, notes } = found;
  const team = user.isAdmin ? (await people(user)).map((p) => ({ name: p.full_name || p.email, email: p.email })) : [];
  return (
    <>
      <Link className="back" href="/roles"><Icon name="back" />Roles</Link>
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <div className="title-line" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <h1>{role.title}</h1>
            <span className={"tag " + (role.status === "Open" ? "good" : role.status === "On hold" ? "warn" : "")}>{role.status}</span>
          </div>
          <p className="sub">{[role.department, role.location, plural(members.length, "candidate"), "Consultant: " + (role.assigned_name || "not assigned")].filter(Boolean).join(", ")}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn" href={`/search?in_role=none`}><Icon name="plus" />Add from search</Link>
          <Link className="btn" href={`/roles/${role.id}/edit`}><Icon name="edit" />Edit role</Link>
        </div>
      </div>
      {role.description && (
        <details className="panel card" style={{ marginBottom: 14 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Job description</summary>
          <p className="lead" style={{ marginTop: 10 }}>{role.description}</p>
        </details>
      )}
      <RoleBoard role={{ id: role.id, title: role.title }} members={members} notes={notes} stages={stages}
                 isAdmin={user.isAdmin} ownEmail={user.profile.email} team={team} canEmail={emailReady()} />
    </>
  );
}
