import { DAY, MINUTE, nextWorkweekStart, type WeekStart, workweekKey } from "./time";
import { emptyTotals, type MinuteTotals, type ShiftRecord } from "./types";

/**
 * Nevada overtime (NRS 608.018, NRS 608.0126).
 *
 * - Daily overtime: hours worked over 8 in a "workday", which is a period of
 *   24 consecutive hours beginning when the employee begins work. It applies
 *   only to employees whose regular rate is less than 1.5x the Nevada minimum
 *   wage, and not to employees exempted by 608.018(3) (4x10 agreements, Motor
 *   Carrier Act drivers, collective bargaining agreements...). Use
 *   `dailyOvertimeApplies` to decide.
 * - Weekly overtime: hours over 40 in the workweek (a fixed 7-day week that
 *   starts at local midnight on `weekStartsOn`).
 * - No pyramiding: hours already paid as daily overtime do not count toward
 *   the 40 weekly hours.
 * - Paid rest breaks count as hours worked; unpaid meal periods do not.
 */
export interface OvertimeOptions {
  timeZone: string;
  weekStartsOn: WeekStart;
  /** Whether daily overtime applies to this employee. */
  dailyOvertime: boolean;
  dailyThresholdMinutes?: number;
  weeklyThresholdMinutes?: number;
  /** End time used for shifts that are still open. Defaults to now. */
  now?: Date;
}

export interface OvertimeResult {
  totals: MinuteTotals;
  byShift: Record<string, MinuteTotals>;
  /** Keyed by the local date the workweek starts (yyyy-MM-dd). */
  byWeek: Record<string, MinuteTotals>;
  /** Each 24-hour workday: when it began and minutes worked in it. */
  workdays: { start: Date; minutes: number }[];
}

/** NRS 608.018: daily overtime applies below 1.5x the minimum wage unless exempt. */
export function dailyOvertimeApplies(opts: {
  payRateCents: number;
  minimumWageCents: number;
  exempt: boolean;
  orgEnabled?: boolean;
}): boolean {
  if (opts.orgEnabled === false || opts.exempt) return false;
  return opts.payRateCents < opts.minimumWageCents * 1.5;
}

interface Segment {
  shiftId: string;
  start: number;
  end: number;
}

/** Paid time of a shift: the clock span minus unpaid breaks. */
export function paidSegments(shift: ShiftRecord, now: Date) {
  const start = shift.clockIn.getTime();
  const end = (shift.clockOut ?? now).getTime();
  if (end <= start) return { segments: [] as Segment[], paidBreak: 0, unpaidBreak: 0 };

  const clip = (b: { start: Date | null; end: Date | null }) => {
    if (!b.start) return null;
    const s = Math.max(start, b.start.getTime());
    const e = Math.min(end, (b.end ?? new Date(end)).getTime());
    return e > s ? { s, e } : null;
  };

  let paidBreak = 0;
  const unpaid: { s: number; e: number }[] = [];
  for (const b of shift.breaks) {
    const c = clip(b);
    if (!c) continue;
    if (b.paid) paidBreak += c.e - c.s;
    else unpaid.push(c);
  }
  unpaid.sort((a, b) => a.s - b.s);

  // Merge overlapping unpaid intervals, then subtract them from the span.
  const merged: { s: number; e: number }[] = [];
  for (const u of unpaid) {
    const last = merged[merged.length - 1];
    if (last && u.s <= last.e) last.e = Math.max(last.e, u.e);
    else merged.push({ ...u });
  }
  const segments: Segment[] = [];
  let cursor = start;
  let unpaidBreak = 0;
  for (const u of merged) {
    if (u.s > cursor) segments.push({ shiftId: shift.id, start: cursor, end: u.s });
    unpaidBreak += u.e - u.s;
    cursor = Math.max(cursor, u.e);
  }
  if (end > cursor) segments.push({ shiftId: shift.id, start: cursor, end });
  return { segments, paidBreak, unpaidBreak };
}

const add = (t: MinuteTotals, k: keyof MinuteTotals, ms: number) => {
  t[k] += ms / MINUTE;
};

/** Compute regular, daily-overtime and weekly-overtime minutes for one employee. */
export function computeOvertime(shifts: ShiftRecord[], opts: OvertimeOptions): OvertimeResult {
  const now = opts.now ?? new Date();
  const dailyThreshold = (opts.dailyThresholdMinutes ?? 480) * MINUTE;
  const weeklyThreshold = (opts.weeklyThresholdMinutes ?? 2400) * MINUTE;

  const totals = emptyTotals();
  const byShift: Record<string, MinuteTotals> = {};
  const byWeek: Record<string, MinuteTotals> = {};
  const weekRegular: Record<string, number> = {};
  const workdays: { start: Date; minutes: number }[] = [];

  const pieces: Segment[] = [];
  for (const shift of [...shifts].sort((a, b) => a.clockIn.getTime() - b.clockIn.getTime())) {
    const { segments, paidBreak, unpaidBreak } = paidSegments(shift, now);
    pieces.push(...segments);
    const st = (byShift[shift.id] ??= emptyTotals());
    add(st, "paidBreak", paidBreak);
    add(st, "unpaidBreak", unpaidBreak);
    add(totals, "paidBreak", paidBreak);
    add(totals, "unpaidBreak", unpaidBreak);
  }
  pieces.sort((a, b) => a.start - b.start);

  let anchor: number | null = null;
  let dayWorked = 0;

  for (const piece of pieces) {
    let s = piece.start;
    while (s < piece.end) {
      if (anchor === null || s >= anchor + DAY) {
        anchor = s;
        dayWorked = 0;
        workdays.push({ start: new Date(s), minutes: 0 });
      }
      const weekBoundary = nextWorkweekStart(s, opts.timeZone, opts.weekStartsOn).getTime();
      const cut = Math.min(piece.end, anchor + DAY, weekBoundary);
      const len = cut - s;

      const dailyRemaining = opts.dailyOvertime ? Math.max(0, dailyThreshold - dayWorked) : Infinity;
      const toRegularCandidates = Math.min(len, dailyRemaining);
      const dailyOt = len - toRegularCandidates;

      const wk = workweekKey(s, opts.timeZone, opts.weekStartsOn);
      const weekRemaining = Math.max(0, weeklyThreshold - (weekRegular[wk] ?? 0));
      const regular = Math.min(toRegularCandidates, weekRemaining);
      const weeklyOt = toRegularCandidates - regular;
      weekRegular[wk] = (weekRegular[wk] ?? 0) + regular;
      dayWorked += len;
      workdays[workdays.length - 1].minutes += len / MINUTE;

      const st = (byShift[piece.shiftId] ??= emptyTotals());
      const wt = (byWeek[wk] ??= emptyTotals());
      for (const t of [totals, st, wt]) {
        add(t, "worked", len);
        add(t, "regular", regular);
        add(t, "dailyOvertime", dailyOt);
        add(t, "weeklyOvertime", weeklyOt);
      }
      s = cut;
    }
  }

  return { totals, byShift, byWeek, workdays };
}

/** Round every total to whole minutes (for storage and display). */
export function roundTotals(t: MinuteTotals): MinuteTotals {
  return {
    worked: Math.round(t.worked),
    regular: Math.round(t.regular),
    dailyOvertime: Math.round(t.dailyOvertime),
    weeklyOvertime: Math.round(t.weeklyOvertime),
    paidBreak: Math.round(t.paidBreak),
    unpaidBreak: Math.round(t.unpaidBreak),
  };
}
