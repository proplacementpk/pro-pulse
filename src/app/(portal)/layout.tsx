import Link from "next/link";
import { Logo, Icon } from "@/components/icons";
import { NavLink, ThemeButton } from "@/components/client";
import { initials } from "@/lib/format";
import { requireUser } from "@/lib/user";
import { signOut } from "../login/actions";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="shell">
      <aside className="rail">
        <Link className="brand" href="/search" aria-label="Propulse, go to search"><Logo /></Link>
        <nav className="nav" aria-label="Main">
          <NavLink href="/search" icon="search">Search</NavLink>
          <NavLink href="/add" icon="upload">Add resume</NavLink>
          <NavLink href="/roles" icon="briefcase">Roles</NavLink>
          {user.isAdmin && <NavLink href="/admin" icon="settings">Admin</NavLink>}
        </nav>
        <div className="grow" />
        <div className="who">
          <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
          <span className="text" style={{ minWidth: 0 }}>
            <div className="name" title={user.name}>{user.name}</div>
            <div className="role">{user.isAdmin ? "Admin" : "Consultant"}</div>
          </span>
        </div>
        <div className="rail-actions">
          <ThemeButton />
          <form action={signOut} style={{ display: "contents" }}>
            <button className="btn small" type="submit" title="Sign out of the portal on this device"><Icon name="logout" /><span>Sign out</span></button>
          </form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
