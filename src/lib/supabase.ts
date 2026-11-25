/** A small client for Supabase's sign-in and data APIs. Every data call carries the signed-in
 *  user's own token, so the database's row rules decide what they may see and change. */
import { PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type Params = Record<string, string | number | boolean | null | undefined>;

/** Database errors that mean "the database script for this version has not been run yet". */
export function friendly(message: string): string {
  const text = String(message || "");
  if (/Could not find the function|schema cache|does not exist|PGRST20[24]/.test(text)) {
    return "The database has not had the latest Propulse update yet. An admin runs it from the desktop app: Settings, Data and security, Copy script and open Supabase.";
  }
  if (/JWT expired|invalid JWT|PGRST301/i.test(text)) return "Your sign-in has ended. Sign in again.";
  if (/row-level security|permission denied/i.test(text)) return "Your account is not allowed to do that.";
  return text || "Something went wrong. Try again.";
}

async function call(path: string, opts: { method?: string; token?: string; body?: unknown; params?: Params; prefer?: string } = {}) {
  const url = new URL(SUPABASE_URL + path);
  for (const [k, v] of Object.entries(opts.params || {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = {
    apikey: PUBLISHABLE_KEY,
    Authorization: `Bearer ${opts.token || PUBLISHABLE_KEY}`,
    "X-Propulse-Client": "web", // profile history records "Web portal" for changes made here
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.prefer) headers["Prefer"] = opts.prefer;
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method || "GET", headers, cache: "no-store",
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new ApiError("Could not reach the database. Check the connection and try again.", 503);
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && (data.error_description || data.msg || data.message || data.error)) || `Request failed (${res.status})`;
    throw new ApiError(friendly(String(msg)), res.status);
  }
  return { data, headers: res.headers };
}

export type Tokens = { access_token: string; refresh_token: string; expires_in: number; user?: { id: string; email?: string } };

export const auth = {
  async signIn(email: string, password: string): Promise<Tokens> {
    return (await call("/auth/v1/token", { method: "POST", params: { grant_type: "password" }, body: { email, password } })).data;
  },
  async refresh(refreshToken: string): Promise<Tokens> {
    return (await call("/auth/v1/token", { method: "POST", params: { grant_type: "refresh_token" }, body: { refresh_token: refreshToken } })).data;
  },
  /** Create an account. It has no access until an admin switches it on. */
  async signUp(email: string, password: string, fullName: string): Promise<{ id?: string; user?: { id: string }; access_token?: string }> {
    return (await call("/auth/v1/signup", { method: "POST", body: { email, password, data: { full_name: fullName } } })).data || {};
  },
  async signOut(token: string): Promise<void> {
    try { await call("/auth/v1/logout", { method: "POST", token, body: {} }); } catch { /* the cookie is cleared either way */ }
  },
};

/** "in.(a,b)" for a list of ids. */
export const inList = (ids: Iterable<string>) => `in.(${[...ids].join(",")})`;

export function db(token: string) {
  return {
    async select<T = any>(table: string, params: Params = {}): Promise<T[]> {
      return (await call(`/rest/v1/${table}`, { token, params })).data || [];
    },
    async count(table: string, params: Params = {}): Promise<number> {
      const r = await call(`/rest/v1/${table}`, { token, params: { ...params, select: "id", limit: 1 }, prefer: "count=exact" });
      return Number((r.headers.get("content-range") || "").split("/")[1] || 0);
    },
    async insert<T = any>(table: string, rows: object[], opts: { returning?: boolean; onConflict?: string; ignoreDuplicates?: boolean } = {}): Promise<T[]> {
      const prefer = [opts.returning === false ? "return=minimal" : "return=representation"];
      if (opts.onConflict) prefer.push(opts.ignoreDuplicates ? "resolution=ignore-duplicates" : "resolution=merge-duplicates");
      const params: Params = opts.onConflict ? { on_conflict: opts.onConflict } : {};
      return (await call(`/rest/v1/${table}`, { method: "POST", token, body: rows, params, prefer: prefer.join(",") })).data || [];
    },
    async update(table: string, values: object, filters: Params): Promise<void> {
      await call(`/rest/v1/${table}`, { method: "PATCH", token, body: values, params: filters, prefer: "return=minimal" });
    },
    async remove(table: string, filters: Params): Promise<void> {
      await call(`/rest/v1/${table}`, { method: "DELETE", token, params: filters });
    },
    async rpc<T = any>(fn: string, args: object = {}): Promise<T> {
      return (await call(`/rest/v1/rpc/${fn}`, { method: "POST", token, body: args })).data;
    },
  };
}

export type Db = ReturnType<typeof db>;
