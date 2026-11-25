import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listUsers } from "@/lib/admin";
import { emailReady } from "@/lib/brevo";
import { stages as loadStages } from "@/lib/data";
import { aiReady } from "@/lib/gemini";
import { driveReady } from "@/lib/google";
import { requireUser } from "@/lib/user";
import { Connections, Stages, Users } from "./panels";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const user = await requireUser();
  if (!user.isAdmin) notFound();
  const [users, stages] = await Promise.all([listUsers(user), loadStages(user)]);
  const items = [
    { kind: "gemini", title: "Gemini (reading resumes, meaning-based search)", ready: aiReady(),
      what: "Used by Add resume and by word searches.", missing: "Set GEMINI_API_KEY on the host. Until then resumes are added from the desktop app and search uses words only." },
    { kind: "drive", title: "Google Drive (resume files)", ready: driveReady(),
      what: "Used to store and open resume files.", missing: "Set GOOGLE_SERVICE_ACCOUNT on the host. Until then files cannot be stored or opened here." },
    { kind: "brevo", title: "Brevo (emailing lists)", ready: emailReady(),
      what: "Used by Export, Email this list.", missing: "Set BREVO_API_KEY on the host. Until then lists can be downloaded but not emailed." },
  ];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Admin</h1>
          <p className="sub">Users, stages and connections. Everything else an admin does is in the desktop app.</p>
        </div>
      </div>
      <div className="cols">
        <div className="stack"><Users users={users} me={user.uid} /></div>
        <div className="stack">
          <Stages stages={stages} />
          <Connections items={items} />
        </div>
      </div>
    </>
  );
}
