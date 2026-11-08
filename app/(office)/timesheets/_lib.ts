import "server-only";
import { addDays, format } from "date-fns";
import { fetchAll } from "@/components/people/fetch-all";
import type { AuthContext } from "@/lib/auth/session";
import { computeOvertime, dailyOvertimeApplies } from "@/lib/labor/overtime";
import { toShiftRecords } from "@/lib/labor/records";
import { localDate, startOfLocalDate, startOfWorkweek, type WeekStart } from "@/lib/labor/time";
import { emptyTotals, type MinuteTotals } from "@/lib/labor/types";
import type { Tables } from "@/lib/supabase/types";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export const addDaysYmd = (ymd: string, n: number) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return format(addDays(new Date(y, m - 1, d), n), "yyyy-MM-dd");
};

/** The requested range, or the current workweek in the organization time zone. */
export function resolveRange(auth: AuthContext, from?: string, to?: string) {
  const tz = auth.org.timezone;
  const ws = auth.settings.workweekStartsOn as WeekStart;
  const weekStart = localDate(startOfWorkweek(new Date(), tz, ws), tz);
  let start = from && YMD.test(from) ? from : weekStart;
  let end = to && YMD.test(to) ? to : addDaysYmd(start, 6);
  if (end < start) [start, end] = [end, start];
  if (end > addDaysYmd(start, 92)) end = addDaysYmd(start, 92);
  return { from: start, to: end, weekStart };
}

export type TimesheetBreak = Pick<
  Tables<"breaks">,
  "id" | "kind" | "paid" | "sequence" | "started_at" | "ended_at" | "status"
>;
export type TimesheetShift = Pick<
  Tables<"shifts">,
  "id" | "employee_id" | "work_date" | "clock_in_at" | "clock_out_at" | "status" | "edit_reason" | "source_in"
> & { breaks: TimesheetBreak[] };

export interface EmployeeSummary {
  employeeId: string;
  shifts: number;
  openShifts: number;
  missedBreaks: number;
  totals: MinuteTotals;
  dailyOvertimeApplies: boolean;
  byShift: Record<string, MinuteTotals>;
}

const SELECT =
  "id, employee_id, work_date, clock_in_at, clock_out_at, status, edit_reason, source_in, breaks(id, kind, paid, sequence, started_at, ended_at, status)";

/**
 * Shifts in the range plus overtime per employee. Overtime is computed from the
 * start of the workweek containing `from`, so a range that cuts a week still
 * gets the right weekly threshold; only shifts inside the range are summed.
 */
export async function loadTimesheets(auth: AuthContext, from: string, to: string, employeeId?: string) {
  const tz = auth.org.timezone;
  const ws = auth.settings.workweekStartsOn as WeekStart;
  const labor = auth.settings.labor;
  const extFrom = localDate(startOfWorkweek(startOfLocalDate(from, tz), tz, ws), tz);

  const shifts = await fetchAll<TimesheetShift>((a, b) => {
    let q = auth.supabase
      .from("shifts")
      .select(SELECT)
      .eq("organization_id", auth.org.id)
      .gte("work_date", extFrom)
      .lte("work_date", to)
      .order("clock_in_at")
      .range(a, b);
    if (employeeId) q = q.eq("employee_id", employeeId);
    return q as unknown as PromiseLike<{ data: TimesheetShift[] | null; error: unknown }>;
  });

  // Pay is visible to admins only; for others daily overtime follows the organization setting.
  const { data: comps } = await auth.supabase
    .from("employee_compensation")
    .select("employee_id, pay_rate_cents, daily_ot_exempt")
    .eq("organization_id", auth.org.id)
    .limit(5000);
  const comp = new Map((comps ?? []).map((c) => [c.employee_id, c]));

  const byEmployee = new Map<string, TimesheetShift[]>();
  for (const s of shifts) {
    if (s.status === "void") continue;
    const list = byEmployee.get(s.employee_id) ?? [];
    list.push(s);
    byEmployee.set(s.employee_id, list);
  }

  const summaries = new Map<string, EmployeeSummary>();
  for (const [id, rows] of byEmployee) {
    const c = comp.get(id);
    const daily = c
      ? dailyOvertimeApplies({
          payRateCents: c.pay_rate_cents,
          minimumWageCents: labor.minimumWageCents,
          exempt: c.daily_ot_exempt,
          orgEnabled: labor.dailyOvertime,
        })
      : labor.dailyOvertime;
    const result = computeOvertime(toShiftRecords(rows), {
      timeZone: tz,
      weekStartsOn: ws,
      dailyOvertime: daily,
      dailyThresholdMinutes: labor.dailyOvertimeMinutes,
      weeklyThresholdMinutes: labor.weeklyOvertimeMinutes,
    });
    const inRange = rows.filter((r) => r.work_date >= from);
    const totals = emptyTotals();
    for (const r of inRange) {
      const t = result.byShift[r.id];
      if (!t) continue;
      for (const k of Object.keys(totals) as (keyof MinuteTotals)[]) totals[k] += t[k];
    }
    summaries.set(id, {
      employeeId: id,
      shifts: inRange.length,
      openShifts: inRange.filter((r) => r.status === "active").length,
      missedBreaks: inRange.reduce((n, r) => n + r.breaks.filter((b) => b.status === "missed").length, 0),
      totals,
      dailyOvertimeApplies: daily,
      byShift: result.byShift,
    });
  }

  return { shifts: shifts.filter((s) => s.work_date >= from), summaries };
}
