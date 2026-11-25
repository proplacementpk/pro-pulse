/** Settings an admin keeps in the desktop app that the portal also follows (never the keys themselves). */
import { cache } from "react";
import { GOOGLE_DRIVE_ID } from "./config";
import type { User } from "./user";

export const settings = cache(async (user: User): Promise<Record<string, string>> => {
  const rows = await user.db.select<{ key: string; value: string }>("app_settings", { is_secret: "eq.false", select: "key,value" });
  return Object.fromEntries(rows.map((r) => [r.key, r.value || ""]));
});

export async function driveTarget(user: User): Promise<{ id: string; layout: string }> {
  const s = await settings(user);
  return { id: GOOGLE_DRIVE_ID || s["drive.shared_drive_id"] || "", layout: s["drive.folder_layout"] || "year_month" };
}
