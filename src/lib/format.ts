export function years(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "";
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  const text = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return `${text} ${v === 1 ? "year" : "years"}`;
}

export function niceDate(value: string | null | undefined, withTime = false): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const day = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" });
  return withTime ? `${day}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" })}` : day;
}

export const plural = (n: number, one: string, many = one + "s") => `${n.toLocaleString("en")} ${n === 1 ? one : many}`;

/** "a, b ,c" -> ["a","b","c"] */
export const list = (text: string | null | undefined) =>
  String(text || "").split(",").map((s) => s.trim()).filter(Boolean);

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function fileSize(bytes: number | null | undefined): string {
  const n = Number(bytes || 0);
  if (!n) return "";
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}
