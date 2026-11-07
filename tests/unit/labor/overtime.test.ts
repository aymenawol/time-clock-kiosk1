import { describe, expect, it } from "vitest";
import { computeOvertime, dailyOvertimeApplies, paidSegments, roundTotals } from "@/lib/labor/overtime";
import type { ShiftRecord } from "@/lib/labor/types";

const TZ = "America/Los_Angeles";
// Local wall-clock time in Las Vegas (Pacific) -> instant. Nov 2026 is PST (-08:00).
const at = (iso: string) => new Date(iso);
let n = 0;
const shift = (start: string, end: string | null, breaks: ShiftRecord["breaks"] = []): ShiftRecord => ({
  id: `s${++n}`,
  employeeId: "e1",
  clockIn: at(start),
  clockOut: end ? at(end) : null,
  breaks,
});
const opts = { timeZone: TZ, weekStartsOn: 0 as const, dailyOvertime: true };
const hours = (m: number) => Math.round((m / 60) * 100) / 100;

describe("dailyOvertimeApplies (NRS 608.018)", () => {
  it("applies below 1.5x the $12.00 minimum wage", () => {
    expect(dailyOvertimeApplies({ payRateCents: 1799, minimumWageCents: 1200, exempt: false })).toBe(true);
  });
  it("does not apply at or above $18.00", () => {
    expect(dailyOvertimeApplies({ payRateCents: 1800, minimumWageCents: 1200, exempt: false })).toBe(false);
    expect(dailyOvertimeApplies({ payRateCents: 2500, minimumWageCents: 1200, exempt: false })).toBe(false);
  });
  it("does not apply to exempt employees or when the org turns it off", () => {
    expect(dailyOvertimeApplies({ payRateCents: 1500, minimumWageCents: 1200, exempt: true })).toBe(false);
    expect(dailyOvertimeApplies({ payRateCents: 1500, minimumWageCents: 1200, exempt: false, orgEnabled: false })).toBe(false);
  });
});

describe("computeOvertime: daily overtime", () => {
  it("an 8-hour shift is all regular time", () => {
    const r = computeOvertime([shift("2026-11-09T06:00:00-08:00", "2026-11-09T14:00:00-08:00")], opts);
    expect(roundTotals(r.totals)).toMatchObject({ worked: 480, regular: 480, dailyOvertime: 0, weeklyOvertime: 0 });
  });

  it("a 10-hour shift has 2 hours of daily overtime when eligible", () => {
    const r = computeOvertime([shift("2026-11-09T06:00:00-08:00", "2026-11-09T16:00:00-08:00")], opts);
    expect(hours(r.totals.regular)).toBe(8);
    expect(hours(r.totals.dailyOvertime)).toBe(2);
  });

  it("a 10-hour shift has no daily overtime when not eligible", () => {
    const r = computeOvertime([shift("2026-11-09T06:00:00-08:00", "2026-11-09T16:00:00-08:00")], {
      ...opts,
      dailyOvertime: false,
    });
    expect(hours(r.totals.regular)).toBe(10);
    expect(r.totals.dailyOvertime).toBe(0);
  });

  it("counts a second shift inside the same 24-hour workday (NRS 608.0126)", () => {
    const r = computeOvertime(
      [
        shift("2026-11-09T06:00:00-08:00", "2026-11-09T14:00:00-08:00"),
        shift("2026-11-09T22:00:00-08:00", "2026-11-10T02:00:00-08:00"),
        // Starts after the first workday ended (06:00 next day): a new workday.
        shift("2026-11-10T07:00:00-08:00", "2026-11-10T15:00:00-08:00"),
      ],
      opts,
    );
    expect(hours(r.totals.dailyOvertime)).toBe(4);
    expect(hours(r.totals.regular)).toBe(16);
    expect(r.workdays).toHaveLength(2);
  });

  it("starts a new workday when continuous work crosses the 24-hour mark", () => {
    const r = computeOvertime(
      [
        shift("2026-11-09T06:00:00-08:00", "2026-11-09T14:00:00-08:00"),
        shift("2026-11-09T20:00:00-08:00", "2026-11-10T08:00:00-08:00"),
      ],
      opts,
    );
    // Workday 1 (Mon 06:00-Tue 06:00): 8 regular + 10 overtime. Workday 2: 2 regular.
    expect(hours(r.totals.dailyOvertime)).toBe(10);
    expect(hours(r.totals.regular)).toBe(10);
    expect(r.workdays.map((w) => hours(w.minutes))).toEqual([18, 2]);
  });

  it("uses real elapsed time across the DST change (fall back on 2026-11-01)", () => {
    // 22:00 PDT to 06:00 PST is 9 real hours.
    const r = computeOvertime([shift("2026-10-31T22:00:00-07:00", "2026-11-01T06:00:00-08:00")], opts);
    expect(hours(r.totals.worked)).toBe(9);
    expect(hours(r.totals.dailyOvertime)).toBe(1);
  });
});

describe("computeOvertime: breaks", () => {
  it("excludes the unpaid meal and keeps paid rest breaks", () => {
    const s = shift("2026-11-09T06:00:00-08:00", "2026-11-09T14:30:00-08:00", [
      { kind: "rest", paid: true, start: at("2026-11-09T08:30:00-08:00"), end: at("2026-11-09T08:45:00-08:00") },
      { kind: "meal", paid: false, start: at("2026-11-09T10:00:00-08:00"), end: at("2026-11-09T10:30:00-08:00") },
    ]);
    const r = computeOvertime([s], opts);
    expect(roundTotals(r.totals)).toMatchObject({ worked: 480, regular: 480, dailyOvertime: 0, paidBreak: 15, unpaidBreak: 30 });
  });

  it("clips a meal that is still running to the end of the shift", () => {
    const s = shift("2026-11-09T06:00:00-08:00", "2026-11-09T10:00:00-08:00", [
      { kind: "meal", paid: false, start: at("2026-11-09T09:30:00-08:00"), end: null },
    ]);
    const { segments, unpaidBreak } = paidSegments(s, new Date());
    expect(segments).toHaveLength(1);
    expect(unpaidBreak / 60_000).toBe(30);
  });
});

describe("computeOvertime: weekly overtime", () => {
  const week = (startDay: number, count: number, len: number) =>
    Array.from({ length: count }, (_, i) => {
      const d = String(startDay + i).padStart(2, "0");
      const endH = String(6 + len).padStart(2, "0");
      return shift(`2026-11-${d}T06:00:00-08:00`, `2026-11-${d}T${endH}:00:00-08:00`);
    });

  it("five 9-hour days: 5 h daily overtime, 40 h regular, no weekly overtime", () => {
    const r = computeOvertime(week(9, 5, 9), opts);
    expect(hours(r.totals.dailyOvertime)).toBe(5);
    expect(hours(r.totals.regular)).toBe(40);
    expect(r.totals.weeklyOvertime).toBe(0);
  });

  it("six 8-hour days: 8 h weekly overtime", () => {
    const r = computeOvertime(week(9, 6, 8), opts);
    expect(hours(r.totals.regular)).toBe(40);
    expect(hours(r.totals.weeklyOvertime)).toBe(8);
  });

  it("does not pyramid: four 12-hour days are 16 h daily overtime and no weekly overtime", () => {
    const r = computeOvertime(week(9, 4, 12), opts);
    expect(hours(r.totals.dailyOvertime)).toBe(16);
    expect(hours(r.totals.regular)).toBe(32);
    expect(r.totals.weeklyOvertime).toBe(0);
  });

  it("splits a shift that crosses the workweek boundary (Sunday local midnight)", () => {
    const shifts = [
      ...week(9, 5, 8), // Mon 9 - Fri 13 Nov: 40 h
      shift("2026-11-14T20:00:00-08:00", "2026-11-15T04:00:00-08:00"), // Sat 20:00 - Sun 04:00
    ];
    const r = computeOvertime(shifts, { ...opts, dailyOvertime: false });
    expect(hours(r.byWeek["2026-11-08"].weeklyOvertime)).toBe(4);
    expect(hours(r.byWeek["2026-11-15"].regular)).toBe(4);
  });

  it("supports a Monday workweek start", () => {
    const r = computeOvertime(
      [shift("2026-11-15T20:00:00-08:00", "2026-11-16T04:00:00-08:00")],
      { ...opts, weekStartsOn: 1 },
    );
    expect(Object.keys(r.byWeek).sort()).toEqual(["2026-11-09", "2026-11-16"]);
  });
});

describe("computeOvertime: open shifts", () => {
  it("counts an open shift up to now", () => {
    const r = computeOvertime([shift("2026-11-09T06:00:00-08:00", null)], {
      ...opts,
      now: at("2026-11-09T09:00:00-08:00"),
    });
    expect(hours(r.totals.worked)).toBe(3);
  });
});
