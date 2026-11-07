import { computeOvertime } from "./overtime";
import { DAY, HOUR, localDate, type WeekStart, workweekKey } from "./time";
import type { ShiftRecord } from "./types";

export interface FatigueRules {
  warnShiftHours: number;
  maxShiftHours: number;
  maxOnDutyHours: number;
  minRestHours: number;
  warnConsecutiveDays: number;
  maxWeeklyHours: number;
  weeklyOvertimeWarnHours: number;
}

export type FatigueKind =
  | "long_shift"
  | "on_duty_limit"
  | "short_rest"
  | "consecutive_days"
  | "weekly_hours"
  | "weekly_overtime";

export interface FatigueFinding {
  kind: FatigueKind;
  severity: "warning" | "critical";
  message: string;
  /** Unique per organization; the same finding is never raised twice. */
  dedupeKey: string;
  shiftId: string | null;
  detail: Record<string, number | string>;
}

export interface FatigueInput {
  employeeId: string;
  /** The employee's shifts over at least the last 8 days, open shift included. */
  shifts: ShiftRecord[];
  now: Date;
  timeZone: string;
  weekStartsOn: WeekStart;
  dailyOvertime: boolean;
  rules: FatigueRules;
}

const hours = (ms: number) => Math.round((ms / HOUR) * 10) / 10;

/**
 * Fatigue checks run at clock-in and clock-out. Thresholds default to the
 * FMCSA passenger-carrier hours-of-service limits (49 CFR 395.5: 15 hours on
 * duty, 8 consecutive hours off, 60 hours in 7 days) plus company warnings.
 */
export function evaluateFatigue(input: FatigueInput): FatigueFinding[] {
  const { rules, now, timeZone, employeeId } = input;
  const shifts = [...input.shifts].sort((a, b) => a.clockIn.getTime() - b.clockIn.getTime());
  const findings: FatigueFinding[] = [];
  if (shifts.length === 0) return findings;

  const endOf = (s: ShiftRecord) => (s.clockOut ?? now).getTime();
  const latest = shifts[shifts.length - 1];

  // 1. Long shift.
  const latestLength = endOf(latest) - latest.clockIn.getTime();
  if (latestLength >= rules.warnShiftHours * HOUR) {
    const critical = latestLength >= rules.maxShiftHours * HOUR;
    findings.push({
      kind: "long_shift",
      severity: critical ? "critical" : "warning",
      message: `Shift has run ${hours(latestLength)} h (${critical ? "limit" : "warning"} ${critical ? rules.maxShiftHours : rules.warnShiftHours} h).`,
      dedupeKey: `long_shift:${latest.id}:${critical ? "critical" : "warning"}`,
      shiftId: latest.id,
      detail: { hours: hours(latestLength) },
    });
  }

  // 2. Short rest before the latest shift.
  if (shifts.length >= 2) {
    const previous = shifts[shifts.length - 2];
    if (previous.clockOut) {
      const gap = latest.clockIn.getTime() - previous.clockOut.getTime();
      if (gap < rules.minRestHours * HOUR) {
        findings.push({
          kind: "short_rest",
          severity: gap < (rules.minRestHours / 2) * HOUR ? "critical" : "warning",
          message: `Only ${hours(gap)} h off before this shift (minimum ${rules.minRestHours} h).`,
          dedupeKey: `short_rest:${latest.id}`,
          shiftId: latest.id,
          detail: { restHours: hours(gap) },
        });
      }
    }
  }

  // 3. On-duty period: shifts chained by gaps shorter than the minimum rest.
  let dutyStart = latest.clockIn.getTime();
  let dutyFirstId = latest.id;
  for (let i = shifts.length - 2; i >= 0; i--) {
    const prev = shifts[i];
    if (prev.clockOut && shifts[i + 1].clockIn.getTime() - prev.clockOut.getTime() >= rules.minRestHours * HOUR) break;
    dutyStart = prev.clockIn.getTime();
    dutyFirstId = prev.id;
  }
  const onDuty = endOf(latest) - dutyStart;
  if (onDuty >= rules.maxOnDutyHours * HOUR) {
    findings.push({
      kind: "on_duty_limit",
      severity: "critical",
      message: `${hours(onDuty)} h on duty without ${rules.minRestHours} h off (limit ${rules.maxOnDutyHours} h).`,
      dedupeKey: `on_duty:${dutyFirstId}`,
      shiftId: latest.id,
      detail: { onDutyHours: hours(onDuty) },
    });
  }

  // 4. Consecutive days worked, ending on the latest shift's local date.
  const days = new Set(shifts.map((s) => s.workDate ?? localDate(s.clockIn, timeZone)));
  const lastDay = latest.workDate ?? localDate(latest.clockIn, timeZone);
  const previousDate = (d: string) => {
    const [y, m, dd] = d.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, dd) - DAY).toISOString().slice(0, 10);
  };
  let streak = 0;
  for (let cursor = lastDay; days.has(cursor) && streak < 60; cursor = previousDate(cursor)) streak++;
  if (streak >= rules.warnConsecutiveDays) {
    findings.push({
      kind: "consecutive_days",
      severity: "warning",
      message: `${streak} days in a row without a day off.`,
      dedupeKey: `consecutive:${employeeId}:${lastDay}`,
      shiftId: latest.id,
      detail: { days: streak },
    });
  }

  // 5. Rolling 7-day hours (on the clock, unpaid meals excluded).
  const windowStart = now.getTime() - 7 * DAY;
  const recent = shifts
    .filter((s) => endOf(s) > windowStart)
    .map((s) => (s.clockIn.getTime() < windowStart ? { ...s, clockIn: new Date(windowStart) } : s));
  const rolling = computeOvertime(recent, {
    timeZone,
    weekStartsOn: input.weekStartsOn,
    dailyOvertime: input.dailyOvertime,
    now,
  }).totals.worked;
  if (rolling >= rules.maxWeeklyHours * 60 * 0.9) {
    const critical = rolling >= rules.maxWeeklyHours * 60;
    findings.push({
      kind: "weekly_hours",
      severity: critical ? "critical" : "warning",
      message: `${Math.round(rolling / 6) / 10} h worked in the last 7 days (limit ${rules.maxWeeklyHours} h).`,
      dedupeKey: `weekly_hours:${employeeId}:${lastDay}:${critical ? "critical" : "warning"}`,
      shiftId: latest.id,
      detail: { hours: Math.round(rolling / 6) / 10 },
    });
  }

  // 6. Overtime in the current workweek.
  const weekKey = workweekKey(latest.clockIn, timeZone, input.weekStartsOn);
  const week = computeOvertime(shifts, {
    timeZone,
    weekStartsOn: input.weekStartsOn,
    dailyOvertime: input.dailyOvertime,
    now,
  }).byWeek[weekKey];
  const otMinutes = week ? week.dailyOvertime + week.weeklyOvertime : 0;
  if (otMinutes >= rules.weeklyOvertimeWarnHours * 60) {
    findings.push({
      kind: "weekly_overtime",
      severity: "warning",
      message: `${Math.round(otMinutes / 6) / 10} h of overtime this week.`,
      dedupeKey: `weekly_ot:${employeeId}:${weekKey}`,
      shiftId: latest.id,
      detail: { overtimeHours: Math.round(otMinutes / 6) / 10 },
    });
  }

  return findings;
}
