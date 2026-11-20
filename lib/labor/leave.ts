/**
 * Leave taken, per employee per day, from the leave ledger.
 *
 * An approved request writes a negative ledger entry with the days it covers
 * (`takenFrom`..`takenTo`). Its hours are spread evenly over those calendar
 * days, in whole minutes, with any remainder going to the earliest days so the
 * total is exact.
 *
 * PTO, vacation and sick leave are paid at the employee's regular rate. FMLA
 * leave is job-protected but unpaid under federal law (29 U.S.C. 2612(c)), so
 * it is tracked separately and not paid. An employee who uses PTO during FMLA
 * leave has a separate PTO entry for those hours.
 */

export type LeaveKind = "pto" | "vacation" | "sick" | "fmla";

export interface LeaveEntry {
  employeeId: string;
  kind: LeaveKind;
  /** Ledger hours. Deductions (leave taken) are negative. */
  hours: number;
  takenFrom: string | null;
  takenTo: string | null;
}

export interface DayLeave {
  paidMinutes: number;
  fmlaMinutes: number;
}

/** employeeId -> YYYY-MM-DD -> leave */
export type LeaveByDay = Map<string, Map<string, DayLeave>>;

const DAY = 86_400_000;
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);
const parse = (d: string) => Date.parse(`${d}T00:00:00Z`);

export function leaveByDay(entries: LeaveEntry[], startsOn: string, endsOn: string): LeaveByDay {
  const out: LeaveByDay = new Map();
  for (const e of entries) {
    if (!(e.hours < 0) || !e.takenFrom) continue;
    const from = parse(e.takenFrom);
    const to = parse(e.takenTo ?? e.takenFrom);
    if (Number.isNaN(from) || Number.isNaN(to) || to < from) continue;
    const days = Math.round((to - from) / DAY) + 1;
    const total = Math.round(-e.hours * 60);
    const base = Math.floor(total / days);
    let extra = total - base * days;
    for (let i = 0; i < days; i++) {
      const minutes = base + (extra > 0 ? 1 : 0);
      if (extra > 0) extra--;
      const date = ymd(from + i * DAY);
      if (date < startsOn || date > endsOn || minutes === 0) continue;
      let byDate = out.get(e.employeeId);
      if (!byDate) out.set(e.employeeId, (byDate = new Map()));
      const d = byDate.get(date) ?? { paidMinutes: 0, fmlaMinutes: 0 };
      if (e.kind === "fmla") d.fmlaMinutes += minutes;
      else d.paidMinutes += minutes;
      byDate.set(date, d);
    }
  }
  return out;
}

/** Total leave for one employee across the period. */
export function leaveTotals(byDate: Map<string, DayLeave> | undefined): DayLeave {
  const t = { paidMinutes: 0, fmlaMinutes: 0 };
  for (const d of byDate?.values() ?? []) {
    t.paidMinutes += d.paidMinutes;
    t.fmlaMinutes += d.fmlaMinutes;
  }
  return t;
}

/** The calendar days a time-off request covers, for the ledger. */
export function leaveDates(type: string, payload: Record<string, unknown>): { from: string; to: string } | null {
  const s = (k: string) => (typeof payload[k] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload[k] as string) ? (payload[k] as string) : null);
  if (type === "time_off") {
    const from = s("start_date");
    const to = s("end_date") ?? from;
    return from && to && to >= from ? { from, to } : null;
  }
  if (type === "fmla_conversion") {
    const from = s("leave_start_date");
    if (!from) return null;
    // The day before the estimated return, or just the start day when no return date is given.
    const ret = s("estimated_return_date");
    const to = ret && ret > from ? ymd(parse(ret) - DAY) : from;
    return { from, to };
  }
  return null;
}
