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
  /** Defaults to "nevada_table". "fixed_two" reproduces the v0 schedule. */
  restPolicy?: "fixed_two" | "nevada_table";
  firstBreakAfterMinutes?: number;
  secondBreakBeforeEndMinutes?: number;
}

/**
 * The v0 schedule, topped up to the Nevada minimum. Two paid rest breaks: break
 * 1 opens `firstBreakAfterMinutes` after clock-in, break 2 opens
 * `secondBreakBeforeEndMinutes` before the planned end, and each window lasts
 * `windowMinutes`.
 *
 * A 30-minute unpaid meal is added at mid-shift for shifts of 8 hours or more
 * on duty (NRS 608.019). v0 tracked it as the "lunch" / "lunch waiver" flags.
 *
 * Shifts of 11 hours or more worked get the extra rest breaks NAC 608.145
 * requires, which v0 never planned.
 */
function planFixedTwo(clockIn: Date, plannedMinutes: number, policy: BreakPolicy): PlannedBreak[] {
  const start = clockIn.getTime();
  const end = start + plannedMinutes * MINUTE;
  const flex = policy.windowMinutes * MINUTE;
  const clamp = (t: number, length: number) => Math.min(Math.max(t, start), end - length * MINUTE);
  const out: PlannedBreak[] = [];
  const b1 = clamp(start + (policy.firstBreakAfterMinutes ?? 135) * MINUTE, policy.restMinutes);
  out.push({
    kind: "rest",
    paid: true,
    sequence: 1,
    plannedMinutes: policy.restMinutes,
    windowStart: new Date(b1),
    windowEnd: new Date(clamp(b1 + flex, policy.restMinutes)),
  });
  const b2 = clamp(end - (policy.secondBreakBeforeEndMinutes ?? 120) * MINUTE, policy.restMinutes);
  if (b2 > b1) {
    out.push({
      kind: "rest",
      paid: true,
      sequence: 2,
      plannedMinutes: policy.restMinutes,
      windowStart: new Date(b2),
      windowEnd: new Date(clamp(b2 + flex, policy.restMinutes)),
    });
  }
  const meal = mealRequired(plannedMinutes);
  const mid = clamp((start + end) / 2 - flex / 2, policy.mealMinutes);
  if (meal) {
    out.push({
      kind: "meal",
      paid: false,
      sequence: 1,
      plannedMinutes: policy.mealMinutes,
      windowStart: new Date(mid),
      windowEnd: new Date(clamp(mid + flex, policy.mealMinutes)),
    });
  }

  // Nevada minimum (NAC 608.145): long shifts need a third rest break at 11
  // hours worked and a fourth at 15. Each extra break goes into the largest
  // gap between the breaks already planned, so the v0 timing of breaks 1 and 2
  // never changes.
  const worked = plannedMinutes - (meal ? policy.mealMinutes : 0);
  const extra = requiredRestBreaks(worked) - out.filter((b) => b.kind === "rest").length;
  const anchors = out.map((b) => b.windowStart.getTime());
  for (let i = 0; i < extra; i++) {
    anchors.sort((a, b) => a - b);
    let at = 0;
    let gap = -1;
    for (let j = 1; j < anchors.length; j++) {
      if (anchors[j] - anchors[j - 1] > gap) {
        gap = anchors[j] - anchors[j - 1];
        at = j;
      }
    }
    const t = clamp(anchors[at - 1] + gap / 2, policy.restMinutes);
    anchors.push(t);
    out.push({
      kind: "rest",
      paid: true,
      sequence: 0,
      plannedMinutes: policy.restMinutes,
      windowStart: new Date(t),
      windowEnd: new Date(clamp(t + flex, policy.restMinutes)),
    });
  }

  out.sort((a, b) => a.windowStart.getTime() - b.windowStart.getTime());
  let seq = 0;
  for (const b of out) if (b.kind === "rest") b.sequence = ++seq;
  return out;
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
  if (policy.restPolicy === "fixed_two") return planFixedTwo(clockIn, plannedMinutes, policy);
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

/** Break policy from organization settings (lib/settings.ts `breaks`). */
export function breakPolicyFrom(b: {
  restMinutes: number;
  mealMinutes: number;
  windowMinutes: number;
  restPolicy: "fixed_two" | "nevada_table";
  firstBreakAfterMinutes: number;
  secondBreakBeforeEndMinutes: number;
}): BreakPolicy {
  return {
    restMinutes: b.restMinutes,
    mealMinutes: b.mealMinutes,
    windowMinutes: b.windowMinutes,
    restPolicy: b.restPolicy,
    firstBreakAfterMinutes: b.firstBreakAfterMinutes,
    secondBreakBeforeEndMinutes: b.secondBreakBeforeEndMinutes,
  };
}
