/** Opens a stored resume. The file comes from Google Drive through the server, so the person
 *  needs no Google account, and only signed-in, switched-on users get it. */
import { NextResponse } from "next/server";
import { driveDownload, driveReady } from "@/lib/google";
import { audit, currentUser } from "@/lib/user";

const TYPES: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", txt: "text/plain; charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", doc: "application/msword", rtf: "application/rtf",
};
const INLINE = new Set(["pdf", "png", "jpg", "jpeg", "webp", "txt"]);

const say = (message: string, status: number) => new NextResponse(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return say("Sign in to open this file.", 401);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return say("That file does not exist.", 404);
  const rows = await user.db.select<{ original_file_name: string; drive_file_id: string | null; drive_link: string | null; file_type: string | null }>(
    "resumes", { id: `eq.${id}`, select: "original_file_name,drive_file_id,drive_link,file_type" });
  const resume = rows[0];
  if (!resume) return say("That file does not exist.", 404);
  if (!resume.drive_file_id) {
    return resume.drive_link ? NextResponse.redirect(resume.drive_link) : say("This resume has no stored file.", 404);
  }
  if (!driveReady()) return say("Google Drive is not set up on the web portal yet. An admin adds the service account key on the host.", 503);
  try {
    const file = await driveDownload(resume.drive_file_id);
    const ext = (resume.file_type || resume.original_file_name.split(".").pop() || "").toLowerCase();
    const name = (resume.original_file_name || "resume").replace(/[^\w .-]/g, "_");
    await audit(user, "resume_opened", { file: resume.original_file_name });
    return new NextResponse(file.body, {
      headers: {
        "Content-Type": TYPES[ext] || "application/octet-stream",
        "Content-Disposition": `${INLINE.has(ext) ? "inline" : "attachment"}; filename="${name}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return say(e instanceof Error ? e.message : "The file could not be opened.", 502);
  }
}
