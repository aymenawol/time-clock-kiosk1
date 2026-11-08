import { describe, expect, it } from "vitest";
import type { ShiftRecord } from "@/lib/labor/types";
import { computePerformance, pctTone, type PerfShift } from "@/lib/scheduling/performance";

const rec = (id: string, hours: number): ShiftRecord => {
  const clockIn = new Date("2026-11-03T16:00:00Z");
  return { id, employeeId: "e1", clockIn, clockOut: new Date(clockIn.getTime() + hours * 3_600_000), workDate: "2026-11-03", breaks: [] };
};
const shift = (id: string, hours: number, extra: Partial<PerfShift> = {}): PerfShift => ({
  record: rec(id, hours),
  hasVehicle: true,
  missedBreaks: 0,
  overrunBreaks: 0,
  ...extra,
});

describe("computePerformance", () => {
  it("adds up hours, break problems and completion rates", () => {
    const p = computePerformance({
      shifts: [shift("a", 8, { missedBreaks: 1 }), shift("b", 4, { overrunBreaks: 2 })],
      inspections: [
        { shiftId: "a", kind: "pre_trip" },
        { shiftId: "a", kind: "post_trip" },
        { shiftId: "b", kind: "pre_trip" },
      ],
      countSheetShiftIds: ["a"],
      attendance: [{ status: "present" }, { status: "late" }, { status: "absent" }, { status: "excused" }],
      countsExpected: true,
    });
    expect(p).toEqual({
      shifts: 2,
      minutes: 720,
      missedBreaks: 1,
      overruns: 2,
      inspectionPct: 75,
      countSheetPct: 50,
      safetyPct: 67,
    });
  });

  it("returns null percentages when nothing was expected", () => {
    const p = computePerformance({
      shifts: [shift("a", 8, { hasVehicle: false })],
      inspections: [],
      countSheetShiftIds: [],
      attendance: [],
      countsExpected: false,
    });
    expect(p.inspectionPct).toBeNull();
    expect(p.countSheetPct).toBeNull();
    expect(p.safetyPct).toBeNull();
  });

  it("uses the v0 colour bands", () => {
    expect([pctTone(100), pctTone(80), pctTone(79), pctTone(60), pctTone(59), pctTone(null)]).toEqual([
      "success",
      "success",
      "warning",
      "warning",
      "danger",
      "neutral",
    ]);
  });
});
