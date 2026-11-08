import { startOfLocalDate } from "@/lib/labor/time";
import { addDays, format } from "date-fns";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** First value of a query param, trimmed. */
export function param(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

export const isYmd = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export function ymdOr(v: string, fallback: string): string {
  return isYmd(v) ? v : fallback;
}

/** [start, end) instants covering the local dates from..to inclusive. */
export function dayRange(from: string, to: string, timeZone: string): { start: string; end: string } {
  const [y, m, d] = to.split("-").map(Number);
  const next = format(addDays(new Date(y, m - 1, d), 1), "yyyy-MM-dd");
  return { start: startOfLocalDate(from, timeZone).toISOString(), end: startOfLocalDate(next, timeZone).toISOString() };
}

/** Escape user text for use inside a PostgREST ilike/or filter. */
export function likeTerm(q: string): string {
  return q.replace(/[%,()*\\]/g, " ").trim();
}

export function pageOf(v: string): number {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function qs(params: Record<string, string | number | undefined | null>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : "";
}
