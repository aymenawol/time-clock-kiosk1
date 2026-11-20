import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

/**
 * Pure layout and formatting helpers for the paper passenger counting sheet.
 * No server-only imports, so both server pages and client components use them.
 */

export const BLOCK_SIZE = 3;
/** The paper has 6 blocks of 3 plus 3 more rows. */
export const MIN_ENTRY_ROWS = 21;

export interface SheetColumn {
  id: string;
  /** The column's own heading ("T-1", "West"). */
  label: string;
  /** Heading shared by adjacent columns ("RAC", "TERM 3"). */
  group: string | null;
  /** Full heading for labels and CSV: "RAC T-1", "TERM 1". */
  heading: string;
}

export function toSheetColumn(l: {
  id: string;
  name: string;
  count_group?: string | null;
  count_label?: string | null;
}): SheetColumn {
  const label = l.count_label?.trim() || l.name;
  const group = l.count_group?.trim() || null;
  return { id: l.id, label, group, heading: group ? `${group} ${label}` : label };
}

export type HeaderCell =
  | { kind: "single"; column: SheetColumn }
  | { kind: "group"; label: string; columns: SheetColumn[] };

/** Adjacent columns that share a group get one group heading over them. */
export function headerCells(columns: SheetColumn[]): HeaderCell[] {
  const out: HeaderCell[] = [];
  for (const c of columns) {
    const last = out.at(-1);
    if (c.group && last?.kind === "group" && last.label === c.group) last.columns.push(c);
    else if (c.group) out.push({ kind: "group", label: c.group, columns: [c] });
    else out.push({ kind: "single", column: c });
  }
  return out;
}

export type SheetItem =
  | { type: "entry"; index: number }
  | { type: "subtotal"; from: number; to: number; block: number };

/** How many entry rows to show: at least the paper's 21, in whole blocks of 3. */
export function entryRowCount(filled: number): number {
  const n = Math.max(MIN_ENTRY_ROWS, filled);
  return Math.ceil(n / BLOCK_SIZE) * BLOCK_SIZE;
}

/**
 * Blocks of 3 entry rows, each followed by a shaded Subtotal row. Like the
 * paper, the last block has no subtotal (the TOTALS boxes follow it).
 */
export function sheetLayout(entryRows: number): SheetItem[] {
  const items: SheetItem[] = [];
  const blocks = Math.ceil(entryRows / BLOCK_SIZE);
  for (let b = 0; b < blocks; b++) {
    const from = b * BLOCK_SIZE;
    const to = Math.min(entryRows, from + BLOCK_SIZE) - 1;
    for (let i = from; i <= to; i++) items.push({ type: "entry", index: i });
    if (b < blocks - 1) items.push({ type: "subtotal", from, to, block: b + 1 });
  }
  return items;
}

export interface CountRowLike {
  counts: Record<string, number>;
}

/** Per-column sum of rows[from..to]. Never a grand total. */
export function columnSums(
  rows: CountRowLike[],
  columnIds: string[],
  from = 0,
  to = rows.length - 1,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of columnIds) {
    let s = 0;
    for (let i = from; i <= to && i < rows.length; i++) s += rows[i]?.counts[id] ?? 0;
    out[id] = s;
  }
  return out;
}

/** Digits only, at most 3, as a number. */
export function parseCount(raw: string): number {
  return parseInt(raw.replace(/\D/g, "").slice(0, 3), 10) || 0;
}

// ---------------------------------------------------------------- header box

/** "Last, First" like the paper. */
export function lastFirst(e: { first_name: string; last_name: string }): string {
  return `${e.last_name}, ${e.first_name}`;
}

/**
 * The paper sheet uses a 24-hour clock without a leading zero ("4:00",
 * "12:00", "18:15"), whatever the org's display setting. The extra parameter is
 * kept for callers but no longer changes the format.
 */
export function fmtPaperTime(d: Date | string | null | undefined, timeZone: string, _clock24h = true): string {
  if (!d) return "";
  return format(new TZDate(new Date(d), timeZone), "H:mm");
}

/** The time-clock stamp: "NOV 12 3:53", 24-hour like the paper. */
export function stampLabel(d: Date | string | null | undefined, timeZone: string, _clock24h = true): string {
  if (!d) return "";
  return format(new TZDate(new Date(d), timeZone), "MMM d H:mm").toUpperCase();
}

/** "06:15-06:30": the window start and start + planned minutes, 24-hour. */
export function breakWindowLabel(windowStart: Date | string, plannedMinutes: number, timeZone: string): string {
  const start = new Date(windowStart);
  const end = new Date(start.getTime() + plannedMinutes * 60_000);
  const f = (d: Date) => format(new TZDate(d, timeZone), "HH:mm");
  return `${f(start)}-${f(end)}`;
}

export interface SlotBreak {
  kind: string;
  sequence: number;
  planned_minutes: number;
  window_start: string | null;
}

/** Planned rest breaks in sequence order, "06:15-06:30 / 09:45-10:00". */
export function formatBreakWindows(breaks: SlotBreak[], timeZone: string): string {
  return breaks
    .filter((b) => b.kind === "rest" && b.window_start)
    .sort((a, b) => a.sequence - b.sequence)
    .map((b) => breakWindowLabel(b.window_start as string, b.planned_minutes, timeZone))
    .join(" / ");
}

/** "HH:mm" in the time zone, for a time input. */
export function timeInputValue(d: Date | string, timeZone: string): string {
  return format(new TZDate(new Date(d), timeZone), "HH:mm");
}

/**
 * The instant for a wall-clock "HH:mm" during a shift: on the clock-in's local
 * date, or the next day when that would be before clock-in (night shifts).
 */
export function resolveSlotStart(clockIn: Date | string, hhmm: string, timeZone: string): Date {
  const ci = new TZDate(new Date(clockIn), timeZone);
  const [h, m] = hhmm.split(":").map(Number);
  const same = new TZDate(ci.getFullYear(), ci.getMonth(), ci.getDate(), h, m, 0, 0, timeZone).getTime();
  const next = new TZDate(ci.getFullYear(), ci.getMonth(), ci.getDate() + 1, h, m, 0, 0, timeZone).getTime();
  return new Date(same >= new Date(clockIn).getTime() ? same : next);
}
