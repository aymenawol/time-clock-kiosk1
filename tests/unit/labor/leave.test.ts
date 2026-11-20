import { describe, expect, it } from "vitest";
import { leaveByDay, leaveDates, leaveTotals, type LeaveEntry } from "@/lib/labor/leave";
import { buildPayLines, type PayrollOptions } from "@/lib/labor/payroll";
import { buildDayRows, payrollDayCsvRows } from "@/lib/scheduling/payroll-days";

const entry = (e: Partial<LeaveEntry>): LeaveEntry => ({
  employeeId: "e1",
  kind: "pto",
  hours: -8,
  takenFrom: "2026-11-10",
  takenTo: "2026-11-10",
  ...e,
});

describe("leaveByDay", () => {
  it("spreads hours evenly over the days and keeps the total exact", () => {
    const m = leaveByDay([entry({ hours: -10, takenFrom: "2026-11-09", takenTo: "2026-11-11" })], "2026-11-01", "2026-11-30");
    const days = m.get("e1")!;
    expect([...days.values()].map((d) => d.paidMinutes)).toEqual([200, 200, 200]);
    expect(leaveTotals(days).paidMinutes).toBe(600);
  });

  it("puts the remainder minute on the earliest days", () => {
    const m = leaveByDay([entry({ hours: -1, takenFrom: "2026-11-09", takenTo: "2026-11-15" })], "2026-11-01", "2026-11-30");
    const mins = [...m.get("e1")!.values()].map((d) => d.paidMinutes);
    expect(mins.reduce((a, b) => a + b, 0)).toBe(60);
    expect(mins[0]).toBeGreaterThanOrEqual(mins[6]);
  });

  it("keeps only the days inside the period", () => {
    const m = leaveByDay([entry({ hours: -24, takenFrom: "2026-11-13", takenTo: "2026-11-15" })], "2026-11-01", "2026-11-14");
    expect([...m.get("e1")!.keys()]).toEqual(["2026-11-13", "2026-11-14"]);
    expect(leaveTotals(m.get("e1")).paidMinutes).toBe(960);
  });

  it("tracks FMLA separately and ignores credits and undated entries", () => {
    const m = leaveByDay(
      [
        entry({ kind: "fmla", hours: -4 }),
        entry({ hours: 40, reason: undefined } as Partial<LeaveEntry>),
        entry({ takenFrom: null, takenTo: null }),
      ],
      "2026-11-01",
      "2026-11-30",
    );
    expect(m.get("e1")!.get("2026-11-10")).toEqual({ paidMinutes: 0, fmlaMinutes: 240 });
  });
});

describe("leaveDates", () => {
  it("uses the time-off start and end dates", () => {
    expect(leaveDates("time_off", { start_date: "2026-12-01", end_date: "2026-12-03" })).toEqual({ from: "2026-12-01", to: "2026-12-03" });
  });
  it("ends FMLA the day before the estimated return", () => {
    expect(leaveDates("fmla_conversion", { leave_start_date: "2026-12-01", estimated_return_date: "2026-12-08" })).toEqual({
      from: "2026-12-01",
      to: "2026-12-07",
    });
    expect(leaveDates("fmla_conversion", { leave_start_date: "2026-12-01" })).toEqual({ from: "2026-12-01", to: "2026-12-01" });
  });
  it("returns null for other forms or bad dates", () => {
    expect(leaveDates("incident_report", {})).toBeNull();
    expect(leaveDates("time_off", { start_date: "soon" })).toBeNull();
  });
});

describe("payroll with leave", () => {
  const opts: PayrollOptions = {
    startsOn: "2026-11-08",
    endsOn: "2026-11-14",
    timeZone: "America/Los_Angeles",
    weekStartsOn: 0,
    minimumWageCents: 1200,
    dailyOvertimeEnabled: true,
    dailyOvertimeMinutes: 480,
    weeklyOvertimeMinutes: 2400,
    overtimeMultiplier: 1.5,
  };
  const emp = { id: "e1", employeeNumber: "2001", name: "Drew Driver", payRateCents: 1650, dailyOtExempt: false };
  const start = new Date("2026-11-09T06:00:00-08:00");
  const shifts = new Map([
    ["e1", [{ id: "s1", employeeId: "e1", clockIn: start, clockOut: new Date(start.getTime() + 8 * 3_600_000), workDate: "2026-11-09", breaks: [] }]],
  ]);
  const leave = leaveByDay([entry({ hours: -8, takenFrom: "2026-11-10", takenTo: "2026-11-10" }), entry({ kind: "fmla", hours: -8, takenFrom: "2026-11-11", takenTo: "2026-11-11" })], opts.startsOn, opts.endsOn);

  it("pays PTO at the regular rate, not FMLA, and never as overtime", () => {
    const [line] = buildPayLines([emp], shifts, opts, leave);
    expect(line.leave_minutes).toBe(480);
    expect(line.detail.fmlaMinutes).toBe(480);
    expect(line.detail.leaveCents).toBe(13200);
    expect(line.gross_cents).toBe(13200 + 13200);
    expect(line.daily_ot_minutes + line.weekly_ot_minutes).toBe(0);
  });

  it("gives an employee with only leave a pay line", () => {
    const lines = buildPayLines([emp], new Map(), opts, leave);
    expect(lines).toHaveLength(1);
    expect(lines[0].regular_minutes).toBe(0);
  });

  it("fills the v0 pto_hours and fmla_hours columns per day", () => {
    const rows = buildDayRows([emp], shifts, [], new Map(), opts, leave);
    expect(rows.map((r) => r.work_date)).toEqual(["2026-11-09", "2026-11-10", "2026-11-11"]);
    const csv = payrollDayCsvRows(rows, opts.startsOn, opts.endsOn);
    const header = csv[0] as string[];
    const pto = header.indexOf("pto_hours");
    const fmla = header.indexOf("fmla_hours");
    expect(csv[2][pto]).toBe(8);
    expect(csv[3][fmla]).toBe(8);
    expect(csv[3][header.indexOf("gross_pay")]).toBe("0.00");
  });
});
