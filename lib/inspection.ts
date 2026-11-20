/**
 * Pure helpers for the paper "VEHICLE INSPECTION" form. No I/O here, so they
 * are unit-tested. The paper is the source of truth for the layout.
 */

export type InspectionKind = "pre_trip" | "post_trip";
export type Mark = "ok" | "x" | "na";
export const MARK_TEXT: Record<Mark, string> = { ok: "OK", x: "X", na: "NA" };

export const REVIEW_LINE =
  "I indicate by my signature that I have reviewed the previous operator's vehicle inspection report.";
export const INSTRUCTION_LINE =
  'Inspect all items on DVL. Use "OK" if no defects found; use "X" if defect is found; use "NA" if not applicable. Turn in daily.';
export const MINI_FOOTNOTE = '*Indicates items to be checked on a "Mini Pre-Trip" Inspection.';

export interface PaperItem {
  id: string;
  category: string;
  label: string;
  critical: boolean;
  sort: number;
  paper_column: number;
  mini: boolean;
  psi: boolean;
  subgroup: string | null;
  pre_trip_only: boolean;
  hint: string | null;
}

/** One entry in inspections.results. */
export interface ResultEntry {
  item_id: string;
  category: string;
  label: string;
  critical: boolean;
  mark: Mark | null;
  psi: number | null;
  note: string | null;
}

/** Pre-trip checks every item. The post-trip checks only starred items that are not shaded. */
export function isItemActive(kind: InspectionKind, item: Pick<PaperItem, "mini" | "pre_trip_only">): boolean {
  return kind === "pre_trip" ? true : item.mini && !item.pre_trip_only;
}

export function itemsForKind<T extends Pick<PaperItem, "mini" | "pre_trip_only">>(kind: InspectionKind, items: T[]): T[] {
  return items.filter((it) => isItemActive(kind, it));
}

/** Beginning to end odometer. Null when either is missing or the end is lower. */
export function milesDriven(begin: number | null | undefined, end: number | null | undefined): number | null {
  if (begin == null || end == null) return null;
  if (!Number.isFinite(begin) || !Number.isFinite(end) || end < begin) return null;
  return end - begin;
}

/** A user-facing message when End Miles is below Beginning Miles, otherwise null. */
export function milesError(begin: number | null | undefined, end: number | null | undefined): string | null {
  if (begin == null || end == null) return null;
  if (end < begin) {
    return `End miles (${end.toLocaleString("en-US")}) can't be lower than beginning miles (${begin.toLocaleString("en-US")}). Check both readings.`;
  }
  return null;
}

/** Whole minutes between two instants, or null if either is missing or the end is earlier. */
export function timeWorkedMinutes(start: string | Date | null | undefined, end: string | Date | null | undefined): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / 60_000);
}

/** 485 -> "8:05". Null -> "". */
export function fmtWorked(minutes: number | null): string {
  if (minutes === null) return "";
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Read a result entry, accepting the older `ok: boolean` form. */
export function readMark(entry: { mark?: unknown; ok?: unknown } | null | undefined): Mark | null {
  if (!entry) return null;
  if (entry.mark === "ok" || entry.mark === "x" || entry.mark === "na") return entry.mark;
  if (entry.ok === true) return "ok";
  if (entry.ok === false) return "x";
  return null;
}

export function parseResults(raw: unknown): ResultEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: ResultEntry[] = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const r = e as Record<string, unknown>;
    if (typeof r.item_id !== "string") continue;
    out.push({
      item_id: r.item_id,
      category: typeof r.category === "string" ? r.category : "General",
      label: typeof r.label === "string" ? r.label : "Item",
      critical: r.critical === true,
      mark: readMark(r),
      psi: typeof r.psi === "number" && Number.isFinite(r.psi) ? r.psi : null,
      note: typeof r.note === "string" && r.note ? r.note : null,
    });
  }
  return out;
}

/** Next mark when a driver taps a box: blank, OK, X, NA, then blank again. */
export function nextMark(current: Mark | null): Mark | null {
  if (current === null) return "ok";
  if (current === "ok") return "x";
  if (current === "x") return "na";
  return null;
}

export interface PaperSectionData<T extends PaperItem = PaperItem> {
  title: string;
  left: T[];
  right: T[];
}

/** Group items into sections (paper order) with a left and a right column. */
export function toSections<T extends PaperItem>(items: T[]): PaperSectionData<T>[] {
  const sorted = [...items].sort((a, b) => a.sort - b.sort);
  const map = new Map<string, PaperSectionData<T>>();
  for (const it of sorted) {
    let s = map.get(it.category);
    if (!s) {
      s = { title: it.category, left: [], right: [] };
      map.set(it.category, s);
    }
    (it.paper_column === 2 ? s.right : s.left).push(it);
  }
  return [...map.values()];
}

/** Neutral footer line: "DVIR · {vehicle type}". */
export function sheetFooter(vehicleType: string | null | undefined): string {
  const t = vehicleType?.trim();
  return t ? `DVIR · ${t}` : "DVIR";
}

export function countX(results: ResultEntry[]): number {
  return results.filter((r) => r.mark === "x").length;
}
