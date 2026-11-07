import { describe, expect, it } from "vitest";
import { evaluateFatigue, type FatigueRules } from "@/lib/labor/fatigue";
import type { ShiftRecord } from "@/lib/labor/types";

const TZ = "America/Los_Angeles";
const rules: FatigueRules = {
  warnShiftHours: 10,
  maxShiftHours: 12,
  maxOnDutyHours: 15,
  minRestHours: 8,
  warnConsecutiveDays: 6,
  maxWeeklyHours: 60,
  weeklyOvertimeWarnHours: 10,
};
let n = 0;
const shift = (start: string, end: string | null, workDate?: string): ShiftRecord => ({
  id: `s${++n}`,
  employeeId: "e1",
  clockIn: new Date(start),
  clockOut: end ? new Date(end) : null,
  workDate,
  breaks: [],
});
const run = (shifts: ShiftRecord[], now: string, dailyOvertime = true) =>
  evaluateFatigue({ employeeId: "e1", shifts, now: new Date(now), timeZone: TZ, weekStartsOn: 0, dailyOvertime, rules });
const kinds = (f: ReturnType<typeof run>) => f.map((x) => `${x.kind}:${x.severity}`);

describe("evaluateFatigue", () => {
  it("raises nothing for a normal 8-hour shift", () => {
    expect(run([shift("2026-11-09T06:00:00-08:00", "2026-11-09T14:00:00-08:00")], "2026-11-09T14:00:00-08:00")).toEqual([]);
  });

  it("warns at 10 hours and is critical at 12 hours", () => {
    expect(kinds(run([shift("2026-11-09T06:00:00-08:00", null)], "2026-11-09T16:30:00-08:00"))).toContain("long_shift:warning");
    expect(kinds(run([shift("2026-11-09T06:00:00-08:00", null)], "2026-11-09T18:00:00-08:00"))).toContain("long_shift:critical");
  });

  it("flags short rest between shifts", () => {
    const six = run(
      [shift("2026-11-09T14:00:00-08:00", "2026-11-09T22:00:00-08:00"), shift("2026-11-10T04:00:00-08:00", null)],
      "2026-11-10T04:00:00-08:00",
    );
    expect(kinds(six)).toContain("short_rest:warning");
    const three = run(
      [shift("2026-11-09T14:00:00-08:00", "2026-11-09T22:00:00-08:00"), shift("2026-11-10T01:00:00-08:00", null)],
      "2026-11-10T01:00:00-08:00",
    );
    expect(kinds(three)).toContain("short_rest:critical");
  });

  it("flags 15 hours on duty when shifts are chained without 8 hours off", () => {
    const f = run(
      [shift("2026-11-09T05:00:00-08:00", "2026-11-09T12:00:00-08:00"), shift("2026-11-09T13:00:00-08:00", null)],
      "2026-11-09T20:00:00-08:00",
    );
    expect(kinds(f)).toContain("on_duty_limit:critical");
  });

  it("warns on the sixth consecutive day but not the fifth", () => {
    const days = (count: number) =>
      Array.from({ length: count }, (_, i) => {
        const d = String(9 + i).padStart(2, "0");
        return shift(`2026-11-${d}T06:00:00-08:00`, `2026-11-${d}T12:00:00-08:00`, `2026-11-${d}`);
      });
    expect(kinds(run(days(5), "2026-11-13T12:00:00-08:00"))).not.toContain("consecutive_days:warning");
    expect(kinds(run(days(6), "2026-11-14T12:00:00-08:00"))).toContain("consecutive_days:warning");
  });

  it("is critical above 60 hours in 7 days", () => {
    const shifts = Array.from({ length: 7 }, (_, i) => {
      const d = String(8 + i).padStart(2, "0");
      return shift(`2026-11-${d}T05:00:00-08:00`, `2026-11-${d}T14:00:00-08:00`, `2026-11-${d}`);
    });
    expect(kinds(run(shifts, "2026-11-14T14:00:00-08:00"))).toContain("weekly_hours:critical");
  });

  it("warns on 10 hours of overtime in the workweek", () => {
    const shifts = Array.from({ length: 5 }, (_, i) => {
      const d = String(9 + i).padStart(2, "0");
      return shift(`2026-11-${d}T05:00:00-08:00`, `2026-11-${d}T15:00:00-08:00`, `2026-11-${d}`);
    });
    expect(kinds(run(shifts, "2026-11-13T15:00:00-08:00"))).toContain("weekly_overtime:warning");
  });

  it("gives every finding a stable dedupe key", () => {
    const s = [shift("2026-11-09T06:00:00-08:00", null)];
    const a = run(s, "2026-11-09T18:30:00-08:00");
    const b = run(s, "2026-11-09T18:45:00-08:00");
    expect(a.map((x) => x.dedupeKey)).toEqual(b.map((x) => x.dedupeKey));
  });
});
