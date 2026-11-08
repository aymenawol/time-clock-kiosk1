import "server-only";
import type { AuthContext } from "@/lib/auth/session";
import { buildPayLines, type PayLine, type PayrollEmployee, type PayrollOptions } from "@/lib/labor/payroll";
import { toShiftRecords } from "@/lib/labor/records";
import { startOfLocalDate, startOfWorkweek, type WeekStart } from "@/lib/labor/time";
import type { ShiftRecord } from "@/lib/labor/types";
import { addDaysYmd } from "@/lib/scheduling/datetime";
import { buildDayRows, type DayPayRow } from "@/lib/scheduling/payroll-days";

export interface PeriodDates {
  starts_on: string;
  ends_on: string;
}

export interface PeriodData {
  lines: PayLine[];
  days: DayPayRow[];
  /** Shifts still open in the period. They block locking. */
  openShifts: { id: string; name: string; workDate: string }[];
  /** Employees with paid time but a pay rate of 0. */
  zeroRate: { id: string; name: string }[];
  options: PayrollOptions;
}

const SHIFT_SELECT =
  "id, employee_id, clock_in_at, clock_out_at, work_date, status, breaks(kind, paid, started_at, ended_at, status)";

/** Compute a pay period from time records, using lib/labor only. */
export async function loadPeriodData(auth: AuthContext, period: PeriodDates): Promise<PeriodData> {
  const tz = auth.org.timezone;
  const ws = auth.settings.workweekStartsOn as WeekStart;
  const labor = auth.settings.labor;
  const from = startOfWorkweek(startOfLocalDate(period.starts_on, tz), tz, ws);
  const to = startOfLocalDate(addDaysYmd(period.ends_on, 1), tz);

  const [shiftsRes, empsRes, compRes] = await Promise.all([
    auth.supabase
      .from("shifts")
      .select(SHIFT_SELECT)
      .eq("organization_id", auth.org.id)
      .in("status", ["completed", "active"])
      .gte("clock_in_at", from.toISOString())
      .lt("clock_in_at", to.toISOString())
      .limit(20000),
    auth.supabase
      .from("employees")
      .select("id, employee_number, first_name, last_name")
      .eq("organization_id", auth.org.id),
    auth.supabase
      .from("employee_compensation")
      .select("employee_id, pay_rate_cents, daily_ot_exempt")
      .eq("organization_id", auth.org.id),
  ]);

  const rawShifts = shiftsRes.data ?? [];
  const missed = new Map<string, number>();
  for (const s of rawShifts) {
    const n = (s.breaks ?? []).filter((b) => b.status === "missed").length;
    if (n) missed.set(s.id, n);
  }
  const records = toShiftRecords(rawShifts);
  const statusById = new Map(rawShifts.map((s) => [s.id, s.status]));
  const completed = new Map<string, ShiftRecord[]>();
  const open: ShiftRecord[] = [];
  for (const r of records) {
    if (statusById.get(r.id) === "active" || !r.clockOut) {
      open.push(r);
    } else {
      completed.set(r.employeeId, [...(completed.get(r.employeeId) ?? []), r]);
    }
  }

  const comp = new Map((compRes.data ?? []).map((c) => [c.employee_id, c]));
  const people = new Map((empsRes.data ?? []).map((e) => [e.id, e]));
  const employees: PayrollEmployee[] = (empsRes.data ?? []).map((e) => ({
    id: e.id,
    employeeNumber: e.employee_number,
    name: `${e.first_name} ${e.last_name}`,
    payRateCents: comp.get(e.id)?.pay_rate_cents ?? 0,
    dailyOtExempt: comp.get(e.id)?.daily_ot_exempt ?? false,
  }));

  const options: PayrollOptions = {
    startsOn: period.starts_on,
    endsOn: period.ends_on,
    timeZone: tz,
    weekStartsOn: ws,
    minimumWageCents: labor.minimumWageCents,
    dailyOvertimeEnabled: labor.dailyOvertime,
    dailyOvertimeMinutes: labor.dailyOvertimeMinutes,
    weeklyOvertimeMinutes: labor.weeklyOvertimeMinutes,
    overtimeMultiplier: labor.overtimeMultiplier,
  };

  const lines = buildPayLines(employees, completed, options);
  const days = buildDayRows(employees, completed, open, missed, options);

  const openShifts = open
    .filter((s) => s.workDate && s.workDate >= period.starts_on && s.workDate <= period.ends_on)
    .map((s) => {
      const p = people.get(s.employeeId);
      return { id: s.id, name: p ? `${p.first_name} ${p.last_name}` : "Unknown", workDate: s.workDate ?? "" };
    });
  const zeroRate = lines.filter((l) => l.pay_rate_cents === 0).map((l) => ({ id: l.employee_id, name: l.name }));

  return { lines, days, openShifts, zeroRate, options };
}
