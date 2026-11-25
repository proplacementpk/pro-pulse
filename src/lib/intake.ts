/** Saving an added resume: the file to Google Drive, the details to the database. */
import { createCandidate, saveCandidate } from "./data";
import { models } from "./gemini";
import { driveReady, driveUpload } from "./google";
import type { FileInfo } from "./resume";
import { driveTarget } from "./settings";
import { ApiError } from "./supabase";
import { audit, type User } from "./user";

export type Mode = "new" | "update" | "attach";

export async function commitResume(user: User, fields: Record<string, unknown>, info: FileInfo, mode: Mode, target: string | null) {
  if (mode !== "new" && !target) throw new ApiError("Choose which profile this resume belongs to.");
  if (await user.db.count("resumes", { file_hash: `eq.${info.hash}`, ...(target ? { candidate_id: `eq.${target}` } : {}) }) && mode !== "new") {
    throw new ApiError("This exact file is already on that profile.");
  }
  let stored: { id?: string; webViewLink?: string } = {};
  let warning: string | null = null;
  const where = await driveTarget(user);
  if (driveReady() && where.id) {
    try {
      const safe = String(fields.full_name || "Resume").replace(/[^\w .-]/g, "").trim() || "Resume";
      stored = await driveUpload(where.id, where.layout, `${safe} - ${info.name}`, info.mime, info.data);
    } catch (e) {
      warning = `The candidate was saved, but the file could not be stored in Google Drive: ${e instanceof Error ? e.message : "unknown reason"}`;
    }
  } else {
    warning = "The candidate was saved. Google Drive is not set up on the web portal yet, so the file itself was not stored.";
  }
  const values = { ...fields, resume_text: String(fields.full_text || "") };
  let id = target as string;
  if (mode === "new") id = await createCandidate(user, values);
  else if (mode === "update") await saveCandidate(user, id, values);
  await user.db.insert("resumes", [{
    candidate_id: id, drive_file_id: stored.id ?? null, drive_link: stored.webViewLink ?? null,
    original_file_name: info.name, file_type: info.ext, file_size: info.size, file_hash: info.hash,
    parse_model: (await models(user.db)).parse, uploaded_by: user.uid,
  }], { returning: false });
  await audit(user, "resume_added", { candidate_id: id, file: info.name });
  return { candidate_id: id, warning };
}
