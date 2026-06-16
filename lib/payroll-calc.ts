// ─────────────────────────────────────────────────────────────
// Payroll hour calculations (pure TypeScript — no DB dependency)
// ─────────────────────────────────────────────────────────────

export interface DailyHoursInput {
  clockIn: Date
  clockOut: Date
  missedBreaks?: number
}

export interface DailyHoursResult {
  totalHours: number     // raw hours on shift
  regularHours: number   // ≤ 8.0
  overtimeHours: number  // > 8.0 daily threshold
}

/**
 * Calculates daily regular/OT hours from clock-in/out timestamps.
 * Threshold: 8 hours/day per FLSA standard.
 */
export function calcDailyHours(clockIn: Date, clockOut: Date): DailyHoursResult {
  const totalHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)
  const regularHours = Math.min(totalHours, 8.0)
  const overtimeHours = Math.max(0, totalHours - 8.0)
  return { totalHours, regularHours, overtimeHours }
}

// ─────────────────────────────────────────────────────────────
// Weekly OT redistribution (40-hour threshold)
// ─────────────────────────────────────────────────────────────

export interface WeeklyRecord {
  work_date: string    // ISO date
  regular_hours: number
  overtime_hours: number
  pto_hours: number
  fmla_hours: number
}

/**
 * Redistributes hours so that weekly total paid hours never exceed 40 regular.
 * Any excess becomes overtime (this is the weekly OT check on top of daily).
 * Returns updated records.
 */
export function calcWeeklyOT(records: WeeklyRecord[]): WeeklyRecord[] {
  const sorted = [...records].sort((a, b) => a.work_date.localeCompare(b.work_date))

  let weeklyRegular = 0
  return sorted.map(r => {
    const adjusted = { ...r }
    const available = Math.max(0, 40 - weeklyRegular)
    if (r.regular_hours > available) {
      // Remaining regular beyond 40h weekly threshold becomes OT
      adjusted.overtime_hours = r.overtime_hours + (r.regular_hours - available)
      adjusted.regular_hours = available
    }
    weeklyRegular += adjusted.regular_hours
    return adjusted
  })
}

// ─────────────────────────────────────────────────────────────
// CSV export builder
// ─────────────────────────────────────────────────────────────

export interface PayrollRow {
  employee_name: string
  employee_id: string
  period_start: string
  period_end: string
  work_date: string
  regular_hours: number
  overtime_hours: number
  pto_hours: number
  fmla_hours: number
  total_paid_hours: number
  missed_breaks: number
  is_incomplete: boolean
}

const CSV_HEADERS: (keyof PayrollRow)[] = [
  'employee_name',
  'employee_id',
  'period_start',
  'period_end',
  'work_date',
  'regular_hours',
  'overtime_hours',
  'pto_hours',
  'fmla_hours',
  'total_paid_hours',
  'missed_breaks',
  'is_incomplete',
]

/**
 * Converts payroll rows to a CSV string for client-side download.
 */
export function buildPayrollCSV(rows: PayrollRow[]): string {
  const escape = (val: unknown) => {
    const str = String(val ?? '')
    return str.includes(',') ? `"${str.replace(/"/g, '""')}"` : str
  }

  const header = CSV_HEADERS.join(',')
  const lines = rows.map(row => CSV_HEADERS.map(k => escape(row[k])).join(','))
  return [header, ...lines].join('\n')
}

/**
 * Detects whether a fatigue alert should be raised based on shift duration.
 * 10+ hours = single_shift alert.
 */
export function shouldRaiseFatigueAlert(totalHours: number): boolean {
  return totalHours >= 10
}

// ─────────────────────────────────────────────────────────────
// N8 — weekly fatigue / OT thresholds (spec: flag >8h/day or >5 days/week)
// ─────────────────────────────────────────────────────────────

/** Days/week beyond which a consecutive_days fatigue alert is raised. */
export const WEEKLY_DAYS_LIMIT = 5
/** Weekly OT hours beyond which an ot_threshold fatigue alert is raised. */
export const WEEKLY_OT_ALERT_HOURS = 10

/**
 * ISO-8601 week key (e.g. "2026-W23") for an ISO date string. Weeks start
 * Monday; pure and deterministic so it is unit-testable.
 */
export function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  const day = (d.getUTCDay() + 6) % 7 // Mon=0..Sun=6
  // Move to the Thursday of this week (ISO weeks are defined by their Thursday).
  d.setUTCDate(d.getUTCDate() - day + 3)
  const year = d.getUTCFullYear()
  const firstThursday = new Date(Date.UTC(year, 0, 4))
  const firstDay = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3)
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
  return `${year}-W${String(week).padStart(2, '0')}`
}

/** Count distinct work days per ISO week. */
export function daysWorkedByWeek(workDates: string[]): Record<string, number> {
  const weeks: Record<string, Set<string>> = {}
  for (const date of workDates) {
    const wk = isoWeekKey(date)
    ;(weeks[wk] ??= new Set()).add(date)
  }
  const out: Record<string, number> = {}
  for (const [wk, set] of Object.entries(weeks)) out[wk] = set.size
  return out
}

/** Largest number of distinct days worked in any single ISO week. */
export function maxDaysInAnyWeek(workDates: string[]): number {
  const counts = Object.values(daysWorkedByWeek(workDates))
  return counts.length ? Math.max(...counts) : 0
}

/** Total OT hours per ISO week from daily records. */
export function weeklyOtHours(records: { work_date: string; overtime_hours: number }[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of records) {
    const wk = isoWeekKey(r.work_date)
    out[wk] = (out[wk] ?? 0) + (r.overtime_hours || 0)
  }
  return out
}
