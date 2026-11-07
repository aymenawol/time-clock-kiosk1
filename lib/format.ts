import { TZDate } from "@date-fns/tz";
import { format, formatDistanceToNowStrict } from "date-fns";

type DateInput = Date | string | number | null | undefined;

const toDate = (d: DateInput) => (d === null || d === undefined ? null : d instanceof Date ? d : new Date(d));

/** "14:05" or "2:05 PM" in the organization time zone. */
export function fmtTime(d: DateInput, timeZone: string, clock24h = false): string {
  const date = toDate(d);
  if (!date) return "-";
  return format(new TZDate(date, timeZone), clock24h ? "HH:mm" : "h:mm a");
}

/** "Mon, Nov 9" in the organization time zone. */
export function fmtDate(d: DateInput, timeZone: string, pattern = "EEE, MMM d"): string {
  const date = toDate(d);
  if (!date) return "-";
  return format(new TZDate(date, timeZone), pattern);
}

export function fmtDateTime(d: DateInput, timeZone: string, clock24h = false): string {
  const date = toDate(d);
  if (!date) return "-";
  return `${fmtDate(date, timeZone, "MMM d")}, ${fmtTime(date, timeZone, clock24h)}`;
}

/** A yyyy-MM-dd date string (no time zone conversion) as "Mon, Nov 9". */
export function fmtLocalDate(ymd: string | null | undefined, pattern = "EEE, MMM d"): string {
  if (!ymd) return "-";
  const [y, m, d] = ymd.split("-").map(Number);
  return format(new Date(y, m - 1, d), pattern);
}

/** 125 -> "2h 05m" */
export function fmtMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return "-";
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? `${h}h ${String(r).padStart(2, "0")}m` : `${r}m`;
}

/** 125 -> "2.08" */
export function fmtHours(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "-";
  return (Math.round((minutes / 60) * 100) / 100).toFixed(2);
}

export function fmtAgo(d: DateInput): string {
  const date = toDate(d);
  if (!date) return "-";
  return `${formatDistanceToNowStrict(date)} ago`;
}

export function fmtMoney(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "-";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function fullName(e: { first_name: string; last_name: string } | null | undefined): string {
  return e ? `${e.first_name} ${e.last_name}` : "-";
}

/** Today's yyyy-MM-dd in the organization time zone. */
export function todayIn(timeZone: string): string {
  return format(new TZDate(Date.now(), timeZone), "yyyy-MM-dd");
}
