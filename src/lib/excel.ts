/** Excel sheets, in the same layout the desktop app writes: a real table with filter buttons,
 *  banded rows, a frozen heading row and clickable links. */
import ExcelJS from "exceljs";

import { DEFAULT_EXPORT, EXPORT_COLUMNS } from "./columns";

export { DEFAULT_EXPORT, EXPORT_COLUMNS };
const CONTEXT = ["stage", "roles_stages"];
const WRAPPED = new Set(["skills", "roles_stages", "latest_note"]);
const LINKS = new Set(["linkedin_url", "drive_link"]);

const filled = (v: unknown) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length);

/** columns = null gives the standard sheet, plus the stage (inside a role) or the roles and stages (from Search). */
export async function exportExcel(rows: Record<string, any>[], sheetTitle: string, columns: string[] | null): Promise<Buffer> {
  let keys: string[];
  if (!columns || !columns.length) {
    keys = [...DEFAULT_EXPORT, ...CONTEXT.filter((k) => rows.some((r) => filled(r[k])))];
    if (keys.includes("stage")) keys = ["full_name", "stage", ...keys.filter((k) => !["full_name", "stage", "roles_stages"].includes(k))];
  } else {
    keys = EXPORT_COLUMNS.map(([k]) => k).filter((k) => columns.includes(k));
    if (!keys.length) keys = ["full_name"];
  }
  const meta = Object.fromEntries(EXPORT_COLUMNS.map(([k, title, width]) => [k, { title, width }]));
  const wb = new ExcelJS.Workbook();
  wb.creator = "Propulse";
  const ws = wb.addWorksheet((sheetTitle.replace(/[\[\]*?/\\:]/g, " ").trim() || "Candidates").slice(0, 31),
    { views: [{ state: "frozen", xSplit: 1, ySplit: 1, showGridLines: false }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const data = rows.map((r) => keys.map((k) => {
    let v = r[k];
    if (Array.isArray(v)) v = v.join(", ");
    if (k === "total_experience_years" && filled(v) && Number.isFinite(Number(v))) v = Number(v);
    return v === undefined || v === "" ? null : v;
  }));
  if (data.length) {
    ws.addTable({ name: "Candidates", ref: "A1", headerRow: true, style: { theme: "TableStyleLight1", showRowStripes: true },
                  columns: keys.map((k) => ({ name: meta[k].title, filterButton: true })), rows: data });
  } else {
    ws.addRow(keys.map((k) => meta[k].title));
  }
  const head = ws.getRow(1);
  head.height = 30;
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD80097" } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  });
  keys.forEach((k, i) => {
    const col = ws.getColumn(i + 1);
    col.width = meta[k].width;
    for (let r = 2; r <= data.length + 1; r++) {
      const cell = ws.getCell(r, i + 1);
      cell.alignment = { vertical: "top", wrapText: WRAPPED.has(k), horizontal: k === "total_experience_years" ? "center" : undefined };
      cell.border = { bottom: { style: "thin", color: { argb: "FFE9E3D9" } } };
      const v = cell.value;
      if (LINKS.has(k) && typeof v === "string" && v.trim()) {
        const url = /^https?:\/\//i.test(v.trim()) ? v.trim() : "https://" + v.trim();
        cell.value = { text: v.trim(), hyperlink: url };
        cell.font = { color: { argb: "FF0B57D0" }, underline: true };
      } else if (k === "full_name") {
        cell.font = { bold: true };
      }
    }
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
