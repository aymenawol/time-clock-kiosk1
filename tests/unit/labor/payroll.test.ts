import { describe, expect, it } from "vitest";
import { buildPayLines, toCsv, type PayrollOptions } from "@/lib/labor/payroll";
import type { ShiftRecord } from "@/lib/labor/types";

const TZ = "America/Los_Angeles";
const base: PayrollOptions = {
  startsOn: "2026-11-08",
  endsOn: "2026-11-14",
  timeZone: TZ,
  weekStartsOn: 0,
  minimumWageCents: 1200,
  dailyOvertimeEnabled: true,
  dailyOvertimeMinutes: 480,
  weeklyOvertimeMinutes: 2400,
  overtimeMultiplier: 1.5,
};
let n = 0;
const day = (date: string, hours: number, open = false): ShiftRecord => {
  const start = new Date(`${date}T06:00:00-08:00`);
  return {
    id: `s${++n}`,
    employeeId: "e1",
    clockIn: start,
    clockOut: open ? null : new Date(start.getTime() + hours * 3_600_000),
    workDate: date,
    breaks: [],
  };
};
const emp = (payRateCents: number, dailyOtExempt = false) => ({
  id: "e1",
  employeeNumber: "1001",
  name: "Dana Driver",
  payRateCents,
  dailyOtExempt,
});
const dates = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"];

describe("buildPayLines", () => {
  it("pays daily overtime to an employee under $18/h", () => {
    const shifts = new Map([["e1", dates.map((d) => day(d, 10))]]);
    const [line] = buildPayLines([emp(1600)], shifts, base);
    expect(line).toMatchObject({
      regular_minutes: 2400,
      daily_ot_minutes: 600,
      weekly_ot_minutes: 0,
      regular_cents: 64000,
      overtime_cents: 24000,
      gross_cents: 88000,
    });
    expect(line.detail.dailyOvertimeApplies).toBe(true);
  });

  it("pays only weekly overtime at $20/h", () => {
    const shifts = new Map([["e1", dates.map((d) => day(d, 10))]]);
    const [line] = buildPayLines([emp(2000)], shifts, base);
    expect(line).toMatchObject({ regular_minutes: 2400, daily_ot_minutes: 0, weekly_ot_minutes: 600 });
    expect(line.overtime_cents).toBe(30000);
  });

  it("respects the daily overtime exemption flag", () => {
    const shifts = new Map([["e1", dates.map((d) => day(d, 10))]]);
    const [line] = buildPayLines([emp(1500, true)], shifts, base);
    expect(line.daily_ot_minutes).toBe(0);
    expect(line.weekly_ot_minutes).toBe(600);
  });

  it("leaves open shifts out of pay", () => {
    const shifts = new Map([["e1", [day("2026-11-09", 8), day("2026-11-10", 0, true)]]]);
    const [line] = buildPayLines([emp(1600)], shifts, base);
    expect(line.regular_minutes).toBe(480);
    expect(line.detail).toMatchObject({ shifts: 1, openShifts: 1 });
  });

  it("counts earlier days of the workweek toward weekly overtime without paying them", () => {
    // Period starts Wednesday; Sun-Tue already had 30 hours.
    const shifts = new Map([
      ["e1", ["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"].map((d) => day(d, 10))],
    ]);
    const [line] = buildPayLines([emp(2000)], shifts, { ...base, startsOn: "2026-11-11" });
    expect(line.regular_minutes).toBe(600);
    expect(line.weekly_ot_minutes).toBe(600);
  });

  it("skips employees with no shifts in the period", () => {
    expect(buildPayLines([emp(1600)], new Map(), base)).toEqual([]);
  });
});

describe("toCsv", () => {
  it("quotes every cell and escapes quotes", () => {
    expect(toCsv([["a", 'b "c"', 3]])).toBe('"a","b ""c""","3"\r\n');
  });
  it("neutralises spreadsheet formulas", () => {
    expect(toCsv([["=SUM(A1)", "+1", "-2", "@x", "ok"]])).toBe(`"'=SUM(A1)","'+1","'-2","'@x","ok"\r\n`);
  });
  it("leaves negative numbers alone", () => {
    expect(toCsv([[-5]])).toBe('"-5"\r\n');
  });
});
