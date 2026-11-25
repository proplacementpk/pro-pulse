import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { getRole, people } from "@/lib/roles";
import { requireUser } from "@/lib/user";
import { RoleForm } from "../../role-form";

export const metadata: Metadata = { title: "Edit role" };

export default async function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const found = await getRole(user, id);
  if (!found) notFound();
  return (
    <>
      <Link className="back" href={`/roles/${id}`}><Icon name="back" />{found.role.title}</Link>
      <div className="page-head"><h1>Edit role</h1></div>
      <RoleForm role={found.role} people={await people(user)} />
    </>
  );
}
