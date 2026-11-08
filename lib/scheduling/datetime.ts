import { TZDate } from "@date-fns/tz";
import { addDays, format } from "date-fns";

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/;
export const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function isLocalInput(value: string): boolean {
  return LOCAL_INPUT.test(value);
}

/** A datetime-local value ("2026-11-07T14:30") read as wall time in `timeZone`. */
export function fromZonedInput(value: string, timeZone: string): Date {
  const m = LOCAL_INPUT.exec(value);
  if (!m) throw new Error(`Invalid local date-time: ${value}`);
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(new TZDate(y, mo - 1, d, h, mi, 0, 0, timeZone).getTime());
}

/** An instant as a datetime-local value in `timeZone`. */
export function toZonedInput(instant: Date | string | number, timeZone: string): string {
  const d = instant instanceof Date ? instant : new Date(instant);
  return format(new TZDate(d.getTime(), timeZone), "yyyy-MM-dd'T'HH:mm");
}

/** yyyy-MM-dd plus n calendar days (no time zone involved). */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return format(addDays(new Date(y, m - 1, d), days), "yyyy-MM-dd");
}

/** Calendar days from a to b (b - a). */
export function daysBetweenYmd(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Whether a string names a time zone this runtime knows. */
export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const US_TIME_ZONES = [
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles, Las Vegas)" },
  { value: "America/Phoenix", label: "Arizona (Phoenix, no DST)" },
  { value: "America/Denver", label: "Mountain (Denver, Salt Lake City)" },
  { value: "America/Boise", label: "Mountain (Boise)" },
  { value: "America/Chicago", label: "Central (Chicago, Dallas)" },
  { value: "America/New_York", label: "Eastern (New York, Atlanta)" },
  { value: "America/Detroit", label: "Eastern (Detroit)" },
  { value: "America/Indiana/Indianapolis", label: "Eastern (Indianapolis)" },
  { value: "America/Anchorage", label: "Alaska (Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
  { value: "America/Puerto_Rico", label: "Atlantic (Puerto Rico)" },
  { value: "Pacific/Guam", label: "Chamorro (Guam)" },
] as const;

export const WEEKDAYS = [
  { value: 0, short: "Su", label: "Sunday" },
  { value: 1, short: "Mo", label: "Monday" },
  { value: 2, short: "Tu", label: "Tuesday" },
  { value: 3, short: "We", label: "Wednesday" },
  { value: 4, short: "Th", label: "Thursday" },
  { value: 5, short: "Fr", label: "Friday" },
  { value: 6, short: "Sa", label: "Saturday" },
] as const;

/** "Mo Tu We Th Fr" for a weekday list (0 = Sunday). */
export function weekdaysLabel(days: readonly number[]): string {
  const set = new Set(days);
  if (set.size === 7) return "Every day";
  return WEEKDAYS.filter((w) => set.has(w.value))
    .map((w) => w.short)
    .join(" ");
}

/** "14:30:00" or "14:30" (Postgres time) as "2:30 PM" or "14:30". */
export function fmtClockTime(value: string | null | undefined, clock24h = false): string {
  if (!value) return "-";
  const [h, m] = value.split(":").map(Number);
  if (clock24h) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}
