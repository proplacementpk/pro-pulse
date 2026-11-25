// Stand-ins for Gemini, Google Drive and Brevo on one local port, so the portal can be tested
// without real keys and without sending anything anywhere.   node tests/fakes.mjs [port]
import { createServer } from "node:http";
import { createHash } from "node:crypto";

const PORT = Number(process.argv[2] || 54500);
const log = { mails: [], uploads: [], folders: [], parses: 0 };
const files = new Map();   // drive file id -> { name, mime, data }
const folders = new Map(); // "parent/name" -> id
let broken = "";          // "drive" or "brevo": that service answers with an error

function vector(text) {   // 768 numbers that differ from text to text, so unrelated texts are far apart
  const out = [];
  let seed = createHash("sha256").update(text).digest();
  while (out.length < 768) {
    for (const b of seed) { if (out.length < 768) out.push((b - 127.5) / 127.5); }
    seed = createHash("sha256").update(seed).digest();
  }
  return out;
}

function parseResume(body) {
  const parts = body.contents?.[0]?.parts || [];
  const text = parts.map((p) => p.text || "").join("\n");
  const get = (k) => (new RegExp(`^${k}:\\s*(.+)$`, "mi").exec(text)?.[1] || "").trim() || null;
  if (parts.some((p) => p.inlineData)) {
    return { full_name: "Pdf Person", email: "pdf.person@example.com", current_title: "Scanned Title", skills: ["Scanning"], experience: [], education: [],
             total_experience_years: 3, full_text: "PDF PERSON scanned resume", fields_to_check: [] };
  }
  return {
    full_name: get("Name"), email: get("Email"), phone: get("Phone"), city: get("City"), country: "Pakistan",
    current_title: get("Title"), current_company: get("Company"), highest_education: get("Education"),
    total_experience_years: get("Years") ? Number(get("Years")) : null, summary: get("Summary"),
    skills: (get("Skills") || "").split(",").map((s) => s.trim()).filter(Boolean),
    experience: [{ job_title: get("Title"), company: get("Company"), start_date: "Jan 2020", end_date: "Present", description: get("Summary") }],
    education: [{ degree: get("Education"), institution: "Punjab University", end_year: "2016" }],
    fields_to_check: ["phone"], religion: "must be dropped", full_text: text.replace(/^RESUME TEXT:\n/, ""),
  };
}

const json = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };

createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const raw = Buffer.concat(chunks);
    const url = new URL(req.url, "http://x");
    const path = url.pathname;
    const body = () => { try { return JSON.parse(raw.toString("utf8") || "{}"); } catch { return {}; } };
    try {
      if (path === "/__log") return json(res, 200, { ...log, files: [...files.keys()] });
      if (path === "/__break") { broken = url.searchParams.get("what") || ""; return json(res, 200, { broken }); }
      // ---- Gemini
      if (path.startsWith("/gemini/")) {
        if (req.headers["x-goog-api-key"] !== "test-gemini-key") return json(res, 403, { error: { message: "API key not valid" } });
        if (path.endsWith("/models")) return json(res, 200, { models: [{ name: "models/gemini-flash-latest" }, { name: "models/gemini-embedding-2" }] });
        if (path.endsWith(":embedContent")) return json(res, 200, { embedding: { values: vector(body().content.parts[0].text) } });
        if (path.endsWith(":generateContent")) {
          log.parses++;
          return json(res, 200, { candidates: [{ content: { parts: [{ text: JSON.stringify(parseResume(body())) }] } }] });
        }
      }
      // ---- Google
      if (path === "/google/token") return json(res, 200, { access_token: "google-token", expires_in: 3600 });
      if (path.startsWith("/drive/") || path.startsWith("/upload/")) {
        if (req.headers.authorization !== "Bearer google-token") return json(res, 401, {});
        if (path === "/drive/drives/drive-123") return json(res, 200, { id: "drive-123", name: "Propulse Resumes" });
        if (path === "/drive/files" && req.method === "GET") {
          const q = url.searchParams.get("q") || "";
          const name = /name = '([^']+)'/.exec(q)?.[1], parent = /'([^']+)' in parents/.exec(q)?.[1];
          const id = folders.get(`${parent}/${name}`);
          return json(res, 200, { files: id ? [{ id }] : [] });
        }
        if (path === "/drive/files" && req.method === "POST") {
          const b = body(); const id = "folder-" + (folders.size + 1);
          folders.set(`${b.parents[0]}/${b.name}`, id); log.folders.push(b.name);
          return json(res, 200, { id });
        }
        if (broken === "drive" && path.startsWith("/upload/")) return json(res, 500, { error: { message: "Backend error" } });
        if (path === "/upload/files" && req.method === "POST") {
          const boundary = /boundary=(.+)$/.exec(req.headers["content-type"] || "")?.[1];
          const text = raw.toString("latin1");
          const [, metaPart, filePart] = text.split(`--${boundary}`);
          const meta = JSON.parse(metaPart.slice(metaPart.indexOf("\r\n\r\n") + 4));
          const start = filePart.indexOf("\r\n\r\n") + 4;
          const data = Buffer.from(filePart.slice(start, filePart.length - 2), "latin1");
          const id = "file-" + (files.size + 1);
          files.set(id, { name: meta.name, data, mime: /Content-Type: (.+)/.exec(filePart)?.[1]?.trim() });
          log.uploads.push({ id, name: meta.name, parent: meta.parents[0], size: data.length });
          return json(res, 200, { id, webViewLink: `https://drive.example/${id}` });
        }
        const m = /^\/drive\/files\/([^/]+)$/.exec(path);
        if (m && files.has(m[1])) { res.writeHead(200, { "Content-Type": "application/octet-stream" }); return res.end(files.get(m[1]).data); }
        if (m && m[1] === "drive-file-1") { res.writeHead(200); return res.end("%PDF-1.4 seeded file"); }
        return json(res, 404, {});
      }
      // ---- Brevo
      if (path.startsWith("/brevo/")) {
        if (req.headers["api-key"] !== "test-brevo-key") return json(res, 401, { message: "Key not found" });
        if (path === "/brevo/account") return json(res, 200, { email: "owner@example.com" });
        if (path === "/brevo/smtp/email") {
          if (broken === "brevo") return json(res, 400, { message: "Sender not verified" });
          const b = body();
          log.mails.push({ to: b.to.map((t) => t.email), subject: b.subject, html: b.htmlContent, sender: b.sender,
                           attachment: b.attachment?.[0]?.name, bytes: Buffer.from(b.attachment?.[0]?.content || "", "base64").length });
          return json(res, 201, { messageId: "x" });
        }
      }
      json(res, 404, { message: "not found: " + path });
    } catch (e) {
      json(res, 500, { message: String(e) });
    }
  });
}).listen(PORT, "127.0.0.1", () => console.log("FAKES READY " + PORT));
