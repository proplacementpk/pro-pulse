/** Gemini calls made by the server. The key never leaves it. */
import { GEMINI_API_KEY } from "./config";
import type { Db } from "./supabase";

const BASE = process.env.PROPULSE_GEMINI_URL || "https://generativelanguage.googleapis.com/v1beta";

export const aiReady = () => Boolean(GEMINI_API_KEY);

/** The model names an admin chose in the desktop app's Settings, so both apps index the same way. */
export async function models(client: Db): Promise<{ parse: string; embed: string }> {
  const out = { parse: "gemini-flash-latest", embed: "gemini-embedding-2" };
  try {
    const rows = await client.select<{ key: string; value: string }>("app_settings",
      { key: "in.(gemini.parse_model,gemini.embed_model)", select: "key,value" });
    for (const r of rows) {
      if (r.key === "gemini.parse_model" && r.value) out.parse = r.value;
      if (r.key === "gemini.embed_model" && r.value) out.embed = r.value;
    }
  } catch { /* the defaults are fine */ }
  return out;
}

/** Text -> the 768 numbers that meaning-based search compares. Returns null when it cannot be made. */
export async function embed(client: Db, text: string, opts: { query?: boolean; title?: string } = {}): Promise<string | null> {
  if (!GEMINI_API_KEY || !text.trim()) return null;
  const body = text.trim().slice(0, 8000);
  const prefixed = opts.query ? `task: search result | query: ${body}` : `title: ${opts.title || "none"} | text: ${body}`;
  try {
    const { embed: model } = await models(client);
    const res = await fetch(`${BASE}/models/${model}:embedContent`, {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(20_000),
      headers: { "x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ content: { parts: [{ text: prefixed }] }, output_dimensionality: 768 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const values: number[] | undefined = data?.embedding?.values || data?.embeddings?.[0]?.values;
    if (!values || values.length !== 768) return null;
    return "[" + values.map((v) => v.toFixed(6)).join(",") + "]";
  } catch {
    return null; // keyword and filter search still work without it
  }
}

/** The text that stands for a candidate in meaning-based search (the same as the desktop app builds). */
export function embeddingText(c: Record<string, any>): string {
  const lines = [
    `${c.current_title || ""} at ${c.current_company || ""}`.replace(/^[ at]+|[ at]+$/g, ""),
    c.summary || "",
    "Skills: " + (c.skills || []).join(", "),
    `${c.total_experience_years ?? ""} years experience. ${c.city || ""}. ${c.highest_education || ""}`,
  ];
  for (const job of (c.experience || []).slice(0, 6)) {
    lines.push(`${job.job_title || ""}, ${job.company || ""}: ${job.description || ""}`);
  }
  return lines.filter((x) => x.trim()).join("\n");
}

/** Proof that the key works and the chosen models exist. */
export async function geminiCheck(client: Db): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("The Gemini key is not set on the host.");
  const res = await fetch(`${BASE}/models?pageSize=200`, { cache: "no-store", signal: AbortSignal.timeout(20_000), headers: { "x-goog-api-key": GEMINI_API_KEY } });
  if (res.status === 400 || res.status === 401 || res.status === 403) throw new Error("Gemini rejected the API key.");
  if (!res.ok) throw new Error(`Gemini answered with an error (${res.status}).`);
  const names: string[] = ((await res.json()).models || []).map((m: { name: string }) => m.name.replace(/^models\//, ""));
  const m = await models(client);
  const missing = [m.parse, m.embed].filter((x) => names.length && !names.includes(x));
  if (missing.length) throw new Error(`The key works, but this model is not available to it: ${missing.join(", ")}. Change the model name in the desktop app's Settings.`);
  return `Connected. Resumes are read with ${m.parse}; search uses ${m.embed}.`;
}
