export type BreakKind = "rest" | "meal";

export interface BreakRecord {
  kind: BreakKind;
  paid: boolean;
  start: Date | null;
  end: Date | null;
}

/** A worked shift (time record). `clockOut` is null while the shift is open. */
export interface ShiftRecord {
  id: string;
  employeeId: string;
  clockIn: Date;
  clockOut: Date | null;
  /** Local date of the clock-in (organization time zone), yyyy-MM-dd. */
  workDate?: string;
  breaks: BreakRecord[];
}

export interface MinuteTotals {
  /** Paid minutes on the clock (excludes unpaid meal time). */
  worked: number;
  regular: number;
  dailyOvertime: number;
  weeklyOvertime: number;
  paidBreak: number;
  unpaidBreak: number;
}

export const emptyTotals = (): MinuteTotals => ({
  worked: 0,
  regular: 0,
  dailyOvertime: 0,
  weeklyOvertime: 0,
  paidBreak: 0,
  unpaidBreak: 0,
});
