import type { Metadata } from "next";
import { aiReady } from "@/lib/gemini";
import { driveReady } from "@/lib/google";
import { MAX_UPLOAD_MB } from "@/lib/resume";
import { driveTarget } from "@/lib/settings";
import { requireUser } from "@/lib/user";
import { AddResume } from "./add";

export const metadata: Metadata = { title: "Add resume" };

export default async function AddPage() {
  const user = await requireUser();
  const drive = driveReady() && Boolean((await driveTarget(user)).id);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Add a resume</h1>
          <p className="sub">Upload one file. The details are read for you; check them, then save.</p>
        </div>
      </div>
      <AddResume ai={aiReady()} drive={drive} maxMb={MAX_UPLOAD_MB} />
    </>
  );
}
