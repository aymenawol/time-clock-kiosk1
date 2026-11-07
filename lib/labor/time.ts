import { TZDate } from "@date-fns/tz";
import { addDays, format, startOfDay, startOfWeek } from "date-fns";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Local calendar date (yyyy-MM-dd) of an instant in a time zone. */
export function localDate(instant: Date | number, timeZone: string): string {
  return format(new TZDate(+instant, timeZone), "yyyy-MM-dd");
}

/** The instant of local midnight that starts the given local date. */
export function startOfLocalDate(date: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(new TZDate(y, m - 1, d, 0, 0, 0, 0, timeZone).getTime());
}

/** The instant the workweek containing `instant` starts (local midnight). */
export function startOfWorkweek(instant: Date | number, timeZone: string, weekStartsOn: WeekStart): Date {
  return new Date(startOfWeek(new TZDate(+instant, timeZone), { weekStartsOn }).getTime());
}

/** The instant the next workweek starts after the one containing `instant`. */
export function nextWorkweekStart(instant: Date | number, timeZone: string, weekStartsOn: WeekStart): Date {
  const start = startOfWeek(new TZDate(+instant, timeZone), { weekStartsOn });
  return new Date(startOfDay(addDays(start, 7)).getTime());
}

/** Local date string of the workweek start (yyyy-MM-dd). */
export function workweekKey(instant: Date | number, timeZone: string, weekStartsOn: WeekStart): string {
  return localDate(startOfWorkweek(instant, timeZone, weekStartsOn), timeZone);
}

export function minutesBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / MINUTE;
}
