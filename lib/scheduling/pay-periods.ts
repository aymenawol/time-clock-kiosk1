import type { PayLine } from "@/lib/labor/payroll";
import { centsToDollars, minutesToHours } from "@/lib/labor/payroll";
import { addDaysYmd, daysBetweenYmd } from "./datetime";

export const PERIOD_DAYS = 14;
export const MAX_PERIOD_SPAN_DAYS = 31;

export interface SuggestedPeriod {
  startsOn: string;
  endsOn: string;
  payDate: string;
}

/**
 * The next 14-day period: the day after the last period ends, or the start of
 * the current workweek when there is none. Pay date defaults to 5 days after
 * the period ends.
 */
export function suggestNextPeriod(lastEndsOn: string | null, currentWeekStart: string): SuggestedPeriod {
  const startsOn = lastEndsOn ? addDaysYmd(lastEndsOn, 1) : currentWeekStart;
  const endsOn = addDaysYmd(startsOn, PERIOD_DAYS - 1);
  return { startsOn, endsOn, payDate: addDaysYmd(endsOn, 5) };
}

/** A user-facing problem with period dates, or null when they are fine. */
export function periodDatesProblem(startsOn: string, endsOn: string, payDate: string | null): string | null {
  if (endsOn < startsOn) return "The end date must be on or after the start date.";
  if (daysBetweenYmd(startsOn, endsOn) > MAX_PERIOD_SPAN_DAYS) return "A pay period can be at most 32 days long.";
  if (payDate && payDate < startsOn) return "The pay date can't be before the period starts.";
  return null;
}

/** Fields stored by lock_pay_period (no names or employee numbers). */
export function lockPayload(lines: PayLine[]) {
  return lines.map(({ name: _name, employee_number: _number, ...rest }) => rest);
}

export interface PayLineView {
  employee_id: string;
  employee_number: string;
  name: string;
  regular_minutes: number;
  daily_ot_minutes: number;
  weekly_ot_minutes: number;
  paid_break_minutes: number;
  unpaid_break_minutes: number;
  leave_minutes: number;
  pay_rate_cents: number;
  regular_cents: number;
  overtime_cents: number;
  gross_cents: number;
}

export const PAYROLL_CSV_HEADER = [
  "Employee number",
  "Name",
  "Regular hours",
  "Daily OT hours",
  "Weekly OT hours",
  "Total OT hours",
  "Paid break hours",
  "Unpaid break hours",
  "Leave hours",
  "Pay rate",
  "Regular pay",
  "Overtime pay",
  "Gross pay",
];

export function payrollCsvRows(lines: PayLineView[]): (string | number)[][] {
  return [
    PAYROLL_CSV_HEADER,
    ...lines.map((l) => [
      l.employee_number,
      l.name,
      minutesToHours(l.regular_minutes),
      minutesToHours(l.daily_ot_minutes),
      minutesToHours(l.weekly_ot_minutes),
      minutesToHours(l.daily_ot_minutes + l.weekly_ot_minutes),
      minutesToHours(l.paid_break_minutes),
      minutesToHours(l.unpaid_break_minutes),
      minutesToHours(l.leave_minutes),
      centsToDollars(l.pay_rate_cents),
      centsToDollars(l.regular_cents),
      centsToDollars(l.overtime_cents),
      centsToDollars(l.gross_cents),
    ]),
  ];
}
