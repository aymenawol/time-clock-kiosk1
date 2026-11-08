import { computeOvertime, dailyOvertimeApplies } from "@/lib/labor/overtime";
import type { PayrollEmployee, PayrollOptions } from "@/lib/labor/payroll";
import { centsToDollars, minutesToHours } from "@/lib/labor/payroll";
import type { ShiftRecord } from "@/lib/labor/types";

/** One employee, one local work date: the v0 payroll sheet row. */
export interface DayPayRow {
  employee_id: string;
  employee_number: string;
  name: string;
  work_date: string;
  regular_minutes: number;
  daily_ot_minutes: number;
  weekly_ot_minutes: number;
  /** Paid and statutory leave. Not tracked per day yet, so always 0. */
  leave_minutes: number;
  total_minutes: number;
  missed_breaks: number;
  /** A shift on this day has no clock-out yet. */
  incomplete: boolean;
  pay_rate_cents: number;
  regular_cents: number;
  overtime_cents: number;
  gross_cents: number;
}

/**
 * Per-day breakdown for the pay period sheet. Uses the same overtime rules as
 * buildPayLines (lib/labor/payroll): pass completed shifts from the start of the
 * workweek that contains `startsOn`, and the still-open shifts separately.
 */
export function buildDayRows(
  employees: PayrollEmployee[],
  completedByEmployee: Map<string, ShiftRecord[]>,
  openShifts: ShiftRecord[],
  missedBreaksByShift: Map<string, number>,
  opts: PayrollOptions,
): DayPayRow[] {
  const rows: DayPayRow[] = [];
  const openByEmployee = new Map<string, ShiftRecord[]>();
  for (const s of openShifts) {
    if (s.workDate && s.workDate >= opts.startsOn && s.workDate <= opts.endsOn) {
      openByEmployee.set(s.employeeId, [...(openByEmployee.get(s.employeeId) ?? []), s]);
    }
  }

  for (const emp of employees) {
    const closed = (completedByEmployee.get(emp.id) ?? []).filter((s) => s.clockOut);
    const inPeriod = closed.filter((s) => s.workDate && s.workDate >= opts.startsOn && s.workDate <= opts.endsOn);
    const open = openByEmployee.get(emp.id) ?? [];
    if (inPeriod.length === 0 && open.length === 0) continue;

    const result = computeOvertime(closed, {
      timeZone: opts.timeZone,
      weekStartsOn: opts.weekStartsOn,
      dailyOvertime: dailyOvertimeApplies({
        payRateCents: emp.payRateCents,
        minimumWageCents: opts.minimumWageCents,
        exempt: emp.dailyOtExempt,
        orgEnabled: opts.dailyOvertimeEnabled,
      }),
      dailyThresholdMinutes: opts.dailyOvertimeMinutes,
      weeklyThresholdMinutes: opts.weeklyOvertimeMinutes,
      now: opts.now,
    });

    const days = new Map<string, DayPayRow>();
    const day = (workDate: string) => {
      let d = days.get(workDate);
      if (!d) {
        d = {
          employee_id: emp.id,
          employee_number: emp.employeeNumber,
          name: emp.name,
          work_date: workDate,
          regular_minutes: 0,
          daily_ot_minutes: 0,
          weekly_ot_minutes: 0,
          leave_minutes: 0,
          total_minutes: 0,
          missed_breaks: 0,
          incomplete: false,
          pay_rate_cents: emp.payRateCents,
          regular_cents: 0,
          overtime_cents: 0,
          gross_cents: 0,
        };
        days.set(workDate, d);
      }
      return d;
    };

    for (const s of inPeriod) {
      const t = result.byShift[s.id];
      if (!t || !s.workDate) continue;
      const d = day(s.workDate);
      d.regular_minutes += t.regular;
      d.daily_ot_minutes += t.dailyOvertime;
      d.weekly_ot_minutes += t.weeklyOvertime;
      d.missed_breaks += missedBreaksByShift.get(s.id) ?? 0;
    }
    for (const s of open) {
      if (!s.workDate) continue;
      const d = day(s.workDate);
      d.incomplete = true;
      d.missed_breaks += missedBreaksByShift.get(s.id) ?? 0;
    }

    for (const d of days.values()) {
      d.regular_minutes = Math.round(d.regular_minutes);
      d.daily_ot_minutes = Math.round(d.daily_ot_minutes);
      d.weekly_ot_minutes = Math.round(d.weekly_ot_minutes);
      const ot = d.daily_ot_minutes + d.weekly_ot_minutes;
      d.total_minutes = d.regular_minutes + ot + d.leave_minutes;
      d.regular_cents = Math.round((d.regular_minutes / 60) * emp.payRateCents);
      d.overtime_cents = Math.round((ot / 60) * emp.payRateCents * opts.overtimeMultiplier);
      d.gross_cents = d.regular_cents + d.overtime_cents;
      rows.push(d);
    }
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name) || a.work_date.localeCompare(b.work_date));
}

/** v0 payroll CSV columns, in v0 order, followed by the rate and dollar columns. */
export const PAYROLL_DAY_CSV_HEADER = [
  "employee_name",
  "employee_id",
  "period_start",
  "period_end",
  "work_date",
  "regular_hours",
  "overtime_hours",
  "pto_hours",
  "fmla_hours",
  "total_paid_hours",
  "missed_breaks",
  "is_incomplete",
  "pay_rate",
  "regular_pay",
  "overtime_pay",
  "gross_pay",
];

export function payrollDayCsvRows(rows: DayPayRow[], periodStart: string, periodEnd: string): (string | number)[][] {
  return [
    PAYROLL_DAY_CSV_HEADER,
    ...rows.map((r) => [
      r.name,
      r.employee_number,
      periodStart,
      periodEnd,
      r.work_date,
      minutesToHours(r.regular_minutes),
      minutesToHours(r.daily_ot_minutes + r.weekly_ot_minutes),
      minutesToHours(r.leave_minutes),
      0,
      minutesToHours(r.total_minutes),
      r.missed_breaks,
      r.incomplete ? "true" : "false",
      centsToDollars(r.pay_rate_cents),
      centsToDollars(r.regular_cents),
      centsToDollars(r.overtime_cents),
      centsToDollars(r.gross_cents),
    ]),
  ];
}
