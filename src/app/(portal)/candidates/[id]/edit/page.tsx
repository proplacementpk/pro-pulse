import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { getCandidate } from "@/lib/data";
import { STATUSES } from "@/lib/search";
import { requireUser } from "@/lib/user";
import { EditForm } from "./form";

export const metadata: Metadata = { title: "Edit candidate" };

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const c = await getCandidate(user, id, false);
  if (!c) notFound();
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(c)) {
    if (typeof v === "string" || typeof v === "number") values[k] = String(v);
  }
  values.skills = (c.skills || []).join(", ");
  return (
    <>
      <Link className="back" href={`/candidates/${id}`}><Icon name="back" />{c.full_name}</Link>
      <div className="page-head"><h1>Edit {c.full_name}</h1></div>
      <EditForm id={id} values={values} statuses={STATUSES} />
    </>
  );
}
