import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { people } from "@/lib/roles";
import { requireUser } from "@/lib/user";
import { RoleForm } from "../role-form";

export const metadata: Metadata = { title: "Add role" };

export default async function NewRolePage() {
  const user = await requireUser();
  return (
    <>
      <Link className="back" href="/roles"><Icon name="back" />Roles</Link>
      <div className="page-head"><h1>Add a role</h1></div>
      <RoleForm role={{ assigned_to: user.uid }} people={await people(user)} />
    </>
  );
}
