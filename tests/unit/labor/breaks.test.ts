import { describe, expect, it } from "vitest";
import { mealRequired, planBreaks, requiredRestBreaks } from "@/lib/labor/breaks";

const policy = { restMinutes: 10, mealMinutes: 30, windowMinutes: 45 };
const clockIn = new Date("2026-11-09T06:00:00-08:00");
const h = (x: number) => x * 60;

describe("requiredRestBreaks (NAC 608.145)", () => {
  it.each([
    [h(3) + 29, 0],
    [h(3.5), 1],
    [h(6) + 59, 1],
    [h(7), 2],
    [h(10) + 59, 2],
    [h(11), 3],
    [h(14) + 59, 3],
    [h(15), 4],
    [h(19), 5],
  ])("%i worked minutes -> %i rest breaks", (minutes, expected) => {
    expect(requiredRestBreaks(minutes)).toBe(expected);
  });
});

describe("mealRequired (NRS 608.019)", () => {
  it("is required from 8 hours on duty", () => {
    expect(mealRequired(479)).toBe(false);
    expect(mealRequired(480)).toBe(true);
  });
});

describe("planBreaks", () => {
  it("plans no breaks for a 3-hour shift", () => {
    expect(planBreaks(clockIn, h(3), policy)).toEqual([]);
  });

  it("plans one paid rest break for a 4-hour shift", () => {
    const plan = planBreaks(clockIn, h(4), policy);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ kind: "rest", paid: true, plannedMinutes: 10 });
  });

  it("plans a meal and two rest breaks for an 8.5-hour shift", () => {
    const plan = planBreaks(clockIn, h(8.5), policy);
    expect(plan.map((b) => b.kind)).toEqual(["rest", "meal", "rest"]);
    const meal = plan.find((b) => b.kind === "meal")!;
    expect(meal.paid).toBe(false);
    expect(meal.plannedMinutes).toBe(30);
  });

  it("plans three rest breaks and a meal for a 12-hour shift", () => {
    const plan = planBreaks(clockIn, h(12), policy);
    expect(plan.filter((b) => b.kind === "rest")).toHaveLength(3);
    expect(plan.filter((b) => b.kind === "meal")).toHaveLength(1);
  });

  it("keeps every window inside the shift and ordered", () => {
    for (const len of [h(4), h(6), h(8), h(10), h(12)]) {
      const plan = planBreaks(clockIn, len, policy);
      const end = clockIn.getTime() + len * 60_000;
      let prev = 0;
      for (const b of plan) {
        expect(b.windowStart.getTime()).toBeGreaterThanOrEqual(clockIn.getTime());
        expect(b.windowEnd.getTime() + b.plannedMinutes * 60_000).toBeLessThanOrEqual(end);
        expect(b.windowEnd.getTime()).toBeGreaterThanOrEqual(b.windowStart.getTime());
        expect(b.windowStart.getTime()).toBeGreaterThanOrEqual(prev);
        prev = b.windowStart.getTime();
      }
    }
  });
});
