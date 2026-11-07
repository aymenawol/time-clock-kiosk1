import { computeOvertime, dailyOvertimeApplies, roundTotals } from "./overtime";
import type { WeekStart } from "./time";
import type { ShiftRecord } from "./types";

export interface PayrollEmployee {
  id: string;
  employeeNumber: string;
  name: string;
  payRateCents: number;
  dailyOtExempt: boolean;
}

export interface PayrollOptions {
  startsOn: string;
  endsOn: string;
  timeZone: string;
  weekStartsOn: WeekStart;
  minimumWageCents: number;
  dailyOvertimeEnabled: boolean;
  dailyOvertimeMinutes: number;
  weeklyOvertimeMinutes: number;
  overtimeMultiplier: number;
  now?: Date;
}

export interface PayLine {
  employee_id: string;
  employee_number: string;
  name: string;
  regular_minutes: number;
  daily_ot_minutes: number;
  weekly_ot_minutes: number;
  paid_break_minutes: number;
  unpaid_break_minutes: number;
  leave_minutes: number;
  pay_rate_cents: number;
  regular_cents: number;
  overtime_cents: number;
  gross_cents: number;
  detail: { shifts: number; openShifts: number; dailyOvertimeApplies: boolean };
}

/**
 * Build pay lines for a period. Pass every completed shift from the start of
 * the workweek that contains `startsOn` through `endsOn`, so weekly overtime
 * for a week that straddles the period start is counted correctly. Only
 * minutes from shifts whose work date falls inside the period are paid here.
 */
export function buildPayLines(
  employees: PayrollEmployee[],
  shiftsByEmployee: Map<string, ShiftRecord[]>,
  opts: PayrollOptions,
): PayLine[] {
  const lines: PayLine[] = [];
  for (const emp of employees) {
    const all = shiftsByEmployee.get(emp.id) ?? [];
    const closed = all.filter((s) => s.clockOut);
    const inPeriod = closed.filter((s) => s.workDate && s.workDate >= opts.startsOn && s.workDate <= opts.endsOn);
    if (inPeriod.length === 0) continue;

    const daily = dailyOvertimeApplies({
      payRateCents: emp.payRateCents,
      minimumWageCents: opts.minimumWageCents,
      exempt: emp.dailyOtExempt,
      orgEnabled: opts.dailyOvertimeEnabled,
    });
    const result = computeOvertime(closed, {
      timeZone: opts.timeZone,
      weekStartsOn: opts.weekStartsOn,
      dailyOvertime: daily,
      dailyThresholdMinutes: opts.dailyOvertimeMinutes,
      weeklyThresholdMinutes: opts.weeklyOvertimeMinutes,
      now: opts.now,
    });

    const sum = { regular: 0, dailyOvertime: 0, weeklyOvertime: 0, paidBreak: 0, unpaidBreak: 0 };
    for (const s of inPeriod) {
      const t = result.byShift[s.id];
      if (!t) continue;
      sum.regular += t.regular;
      sum.dailyOvertime += t.dailyOvertime;
      sum.weeklyOvertime += t.weeklyOvertime;
      sum.paidBreak += t.paidBreak;
      sum.unpaidBreak += t.unpaidBreak;
    }
    const r = roundTotals({ worked: 0, ...sum });
    const regularCents = Math.round((r.regular / 60) * emp.payRateCents);
    const overtimeCents = Math.round(
      ((r.dailyOvertime + r.weeklyOvertime) / 60) * emp.payRateCents * opts.overtimeMultiplier,
    );
    lines.push({
      employee_id: emp.id,
      employee_number: emp.employeeNumber,
      name: emp.name,
      regular_minutes: r.regular,
      daily_ot_minutes: r.dailyOvertime,
      weekly_ot_minutes: r.weeklyOvertime,
      paid_break_minutes: r.paidBreak,
      unpaid_break_minutes: r.unpaidBreak,
      leave_minutes: 0,
      pay_rate_cents: emp.payRateCents,
      regular_cents: regularCents,
      overtime_cents: overtimeCents,
      gross_cents: regularCents + overtimeCents,
      detail: { shifts: inPeriod.length, openShifts: all.length - closed.length, dailyOvertimeApplies: daily },
    });
  }
  return lines.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * CSV with every field quoted and spreadsheet formula injection neutralised
 * (cells starting with = + - @ tab or CR get a leading apostrophe).
 */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export const minutesToHours = (m: number) => Math.round((m / 60) * 100) / 100;
export const centsToDollars = (c: number) => (c / 100).toFixed(2);
