import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { startOfLocalDate } from "@/lib/labor/time";

/** yyyy-MM-dd */
export const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Request time for server pages (kept out of render bodies). */
export function serverNow(): number {
  return Date.now();
}

/** A valid yyyy-MM-dd from a search param, or the fallback. */
export function parseYmd(value: string | string[] | undefined, fallback: string): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || !YMD_RE.test(v)) return fallback;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return fallback;
  return v;
}

/** yyyy-MM-dd shifted by whole days (calendar arithmetic, no time zone). */
export function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** The instants that bound a local calendar date in a time zone. */
export function dayRange(ymd: string, timeZone: string): { start: Date; end: Date } {
  return { start: startOfLocalDate(ymd, timeZone), end: startOfLocalDate(shiftYmd(ymd, 1), timeZone) };
}

/** Value for <input type="datetime-local"> in the organization time zone. */
export function toZonedInput(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  return format(new TZDate(new Date(iso).getTime(), timeZone), "yyyy-MM-dd'T'HH:mm");
}

/** Parse a datetime-local value entered in the organization time zone. */
export function fromZonedInput(value: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(new TZDate(y, mo - 1, d, h, mi, 0, 0, timeZone).getTime());
}

/** 45 -> "45s", 190 -> "3m", 3900 -> "1h 05m" */
export function fmtAge(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}m`;
}

/** 754 seconds -> "12:34"; over an hour -> "1:02:03" */
export function fmtClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}
