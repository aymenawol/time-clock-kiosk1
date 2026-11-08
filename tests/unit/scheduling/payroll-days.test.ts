import { describe, expect, it } from "vitest";
import type { PayrollOptions } from "@/lib/labor/payroll";
import type { ShiftRecord } from "@/lib/labor/types";
import { buildDayRows, PAYROLL_DAY_CSV_HEADER, payrollDayCsvRows } from "@/lib/scheduling/payroll-days";

const opts: PayrollOptions = {
  startsOn: "2026-11-02",
  endsOn: "2026-11-15",
  timeZone: "America/Los_Angeles",
  weekStartsOn: 0,
  minimumWageCents: 1200,
  dailyOvertimeEnabled: true,
  dailyOvertimeMinutes: 480,
  weeklyOvertimeMinutes: 2400,
  overtimeMultiplier: 1.5,
};

const emp = (rate: number) => ({ id: "e1", employeeNumber: "1001", name: "Ada Driver", payRateCents: rate, dailyOtExempt: false });

const shift = (id: string, date: string, startUtc: string, hours: number): ShiftRecord => {
  const clockIn = new Date(startUtc);
  return { id, employeeId: "e1", clockIn, clockOut: new Date(clockIn.getTime() + hours * 3_600_000), workDate: date, breaks: [] };
};

describe("buildDayRows", () => {
  it("splits a 10 hour day into regular and daily overtime for a low-wage employee", () => {
    const s = shift("s1", "2026-11-03", "2026-11-03T16:00:00Z", 10);
    const rows = buildDayRows([emp(1500)], new Map([["e1", [s]]]), [], new Map(), opts);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ work_date: "2026-11-03", regular_minutes: 480, daily_ot_minutes: 120, incomplete: false });
    expect(rows[0].regular_cents).toBe(12000);
    expect(rows[0].overtime_cents).toBe(4500);
    expect(rows[0].gross_cents).toBe(16500);
  });

  it("does not apply daily overtime at 1.5x minimum wage or more", () => {
    const s = shift("s1", "2026-11-03", "2026-11-03T16:00:00Z", 10);
    const rows = buildDayRows([emp(1800)], new Map([["e1", [s]]]), [], new Map(), opts);
    expect(rows[0].daily_ot_minutes).toBe(0);
    expect(rows[0].regular_minutes).toBe(600);
  });

  it("flags open shifts and counts missed breaks", () => {
    const done = shift("s1", "2026-11-03", "2026-11-03T16:00:00Z", 8);
    const open: ShiftRecord = { ...shift("s2", "2026-11-04", "2026-11-04T16:00:00Z", 1), clockOut: null };
    const rows = buildDayRows([emp(1500)], new Map([["e1", [done]]]), [open], new Map([["s1", 2]]), opts);
    expect(rows.map((r) => [r.work_date, r.incomplete, r.missed_breaks])).toEqual([
      ["2026-11-03", false, 2],
      ["2026-11-04", true, 0],
    ]);
  });

  it("ignores shifts outside the period", () => {
    const before = shift("s0", "2026-11-01", "2026-11-01T16:00:00Z", 8);
    expect(buildDayRows([emp(1500)], new Map([["e1", [before]]]), [], new Map(), opts)).toEqual([]);
  });
});

describe("payrollDayCsvRows", () => {
  it("keeps the v0 columns first and appends rate and dollars", () => {
    expect(PAYROLL_DAY_CSV_HEADER.slice(0, 12)).toEqual([
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
    ]);
    const s = shift("s1", "2026-11-03", "2026-11-03T16:00:00Z", 10);
    const rows = buildDayRows([emp(1500)], new Map([["e1", [s]]]), [], new Map(), opts);
    const csv = payrollDayCsvRows(rows, opts.startsOn, opts.endsOn);
    expect(csv[1]).toEqual(["Ada Driver", "1001", "2026-11-02", "2026-11-15", "2026-11-03", 8, 2, 0, 0, 10, 0, "false", "15.00", "120.00", "45.00", "165.00"]);
  });
});
