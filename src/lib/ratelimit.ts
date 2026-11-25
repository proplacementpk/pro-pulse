/** Slows down password guessing: after 5 wrong tries for the same address from the same place,
 *  sign-in is paused for 10 minutes. Kept in this server's memory; Supabase applies its own limits as well. */
const WINDOW = 10 * 60 * 1000;
const LIMIT = 5;
const tries = new Map<string, { count: number; first: number }>();

export function blockedFor(key: string): number {
  const t = tries.get(key);
  if (!t) return 0;
  const left = t.first + WINDOW - Date.now();
  if (left <= 0) { tries.delete(key); return 0; }
  return t.count >= LIMIT ? Math.ceil(left / 60000) : 0;
}

export function failed(key: string): void {
  const now = Date.now();
  const t = tries.get(key);
  if (!t || now - t.first > WINDOW) tries.set(key, { count: 1, first: now });
  else t.count += 1;
  if (tries.size > 5000) {
    for (const [k, v] of tries) if (now - v.first > WINDOW) tries.delete(k);
  }
}

export const cleared = (key: string) => { tries.delete(key); };
