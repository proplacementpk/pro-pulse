/** Turning a list on screen into an Excel sheet, downloaded or emailed. */
import { searchIds } from "./data";
import { exportExcel } from "./excel";
import { sendMail, validEmails } from "./brevo";
import { exportRows, getRole } from "./roles";
import { readFilters, type Raw } from "./search";
import { ApiError } from "./supabase";
import { audit, type User } from "./user";

export type ShareRequest = {
  kind: "search" | "role";
  ids?: string[];          // the ticked candidates; empty means everything listed
  params?: Raw;            // search: the address-bar filters, used when nothing is ticked
  role?: string;           // role: its id
  stages?: string[];       // role: only these stages ("none" for no stage); empty means all
  columns?: string[] | null;
};

export async function buildSheet(user: User, req: ShareRequest): Promise<{ data: Buffer; name: string; title: string; rows: number }> {
  let rows: Record<string, any>[]; let title = "Propulse search";
  if (req.kind === "role") {
    const found = req.role ? await getRole(user, req.role) : null;
    if (!found) throw new ApiError("This role no longer exists.", 404);
    title = found.role.title;
    const wanted = new Set(req.stages || []);
    const ticked = new Set(req.ids || []);
    const members = found.members.filter((m) => (!wanted.size || wanted.has(m.stage_id || "none")) && (!ticked.size || ticked.has(m.candidate_id)));
    rows = await exportRows(user, members.map((m) => m.candidate_id), found.role.id);
  } else {
    const ids = req.ids && req.ids.length ? req.ids.slice(0, 5000) : await searchIds(user, readFilters(req.params || {}));
    rows = await exportRows(user, ids, null);
  }
  if (!rows.length) throw new ApiError("There is nothing to export.");
  const safe = title.replace(/[^\w -]/g, " ").replace(/\s+/g, " ").trim() || "Candidates";
  return { data: await exportExcel(rows, title, req.columns?.length ? req.columns : null), name: `${safe}.xlsx`, title, rows: rows.length };
}

/** Email the sheet. A consultant's list goes to their own address; an admin chooses who gets it. */
export async function emailSheet(user: User, req: ShareRequest, to: string, subject: string, message: string): Promise<string[]> {
  const recipients = user.isAdmin ? validEmails(to) : [user.profile.email];
  if (!recipients.length) throw new ApiError("Enter at least one email address.");
  if (recipients.length > 25) throw new ApiError("Send to 25 addresses at most.");
  const sheet = await buildSheet(user, req);
  const safe = message.trim().slice(0, 4000).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>");
  const html = (safe ? `<p>${safe}</p>` : "") +
    `<p>${sheet.rows} candidate${sheet.rows === 1 ? "" : "s"} attached as an Excel sheet.</p>` +
    `<p style="color:#6F6A63;font-size:12px">Sent from Propulse by ${user.name.replace(/</g, "&lt;")}.</p>`;
  await sendMail(user, recipients, subject.trim().slice(0, 200) || sheet.title, html, { name: sheet.name, data: sheet.data });
  await audit(user, "list_emailed", { to: recipients, rows: sheet.rows, title: sheet.title, columns: req.columns?.length ? req.columns : "standard" });
  return recipients;
}
