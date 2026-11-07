import { MINUTE } from "./time";
import type { BreakKind } from "./types";

/**
 * Nevada meal and rest periods.
 *
 * NRS 608.019(1): a meal period of at least 30 minutes for an employee who
 * works 8 continuous hours. We plan an unpaid meal for any shift that is
 * scheduled to last 8 hours or more on duty.
 *
 * NRS 608.019(2) and NAC 608.145: paid 10-minute rest periods, one per 4 hours
 * worked or major fraction thereof, none required under 3.5 hours:
 *   3.5 to under 7 h = 1, 7 to under 11 h = 2, 11 to under 15 h = 3,
 *   15 to under 19 h = 4, and so on. Unpaid meal time is not counted.
 */
export function requiredRestBreaks(workedMinutes: number): number {
  const hours = workedMinutes / 60;
  if (hours < 3.5) return 0;
  return 1 + Math.floor((hours - 3) / 4);
}

export function mealRequired(onDutyMinutes: number): boolean {
  return onDutyMinutes >= 480;
}

export interface BreakPolicy {
  restMinutes: number;
  mealMinutes: number;
  windowMinutes: number;
}

export interface PlannedBreak {
  kind: BreakKind;
  paid: boolean;
  sequence: number;
  plannedMinutes: number;
  windowStart: Date;
  windowEnd: Date;
}

/**
 * Plan the breaks for a shift that starts at `clockIn` and is expected to last
 * `plannedMinutes` (clock-in to clock-out). Rest breaks are spread evenly; the
 * meal sits at the middle of the shift. Each break gets a window of
 * `windowMinutes` centred on its target time, kept inside the shift.
 */
export function planBreaks(clockIn: Date, plannedMinutes: number, policy: BreakPolicy): PlannedBreak[] {
  const meal = mealRequired(plannedMinutes);
  const workedMinutes = plannedMinutes - (meal ? policy.mealMinutes : 0);
  const rests = requiredRestBreaks(workedMinutes);
  const start = clockIn.getTime();
  const end = start + plannedMinutes * MINUTE;
  const half = (policy.windowMinutes * MINUTE) / 2;

  const window = (target: number, length: number) => {
    let ws = target - half;
    let we = target + half;
    // Keep the whole break inside the shift and not in the first 30 minutes.
    const earliest = start + Math.min(30 * MINUTE, (end - start) / 4);
    const latest = end - length * MINUTE;
    if (ws < earliest) {
      we += earliest - ws;
      ws = earliest;
    }
    if (we > latest) {
      ws -= we - latest;
      we = latest;
    }
    ws = Math.max(ws, earliest);
    return { windowStart: new Date(ws), windowEnd: new Date(Math.max(we, ws)) };
  };

  const planned: PlannedBreak[] = [];
  for (let i = 1; i <= rests; i++) {
    let target = start + ((end - start) * i) / (rests + 1);
    // Move a rest break off the meal slot when they would coincide.
    if (meal && Math.abs(target - (start + end) / 2) < policy.mealMinutes * MINUTE) {
      target += (i <= rests / 2 ? -1 : 1) * policy.windowMinutes * MINUTE;
    }
    planned.push({
      kind: "rest",
      paid: true,
      sequence: i,
      plannedMinutes: policy.restMinutes,
      ...window(target, policy.restMinutes),
    });
  }
  if (meal) {
    planned.push({
      kind: "meal",
      paid: false,
      sequence: 1,
      plannedMinutes: policy.mealMinutes,
      ...window((start + end) / 2, policy.mealMinutes),
    });
  }
  return planned.sort((a, b) => a.windowStart.getTime() - b.windowStart.getTime());
}
