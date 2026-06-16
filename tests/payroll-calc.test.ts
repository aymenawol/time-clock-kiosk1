import { describe, it, expect } from 'vitest'
import {
  calcDailyHours,
  calcWeeklyOT,
  buildPayrollCSV,
  shouldRaiseFatigueAlert,
  type WeeklyRecord,
  type PayrollRow,
} from '@/lib/payroll-calc'

const at = (iso: string) => new Date(iso)

describe('calcDailyHours', () => {
  it('exactly 8h → all regular, no OT', () => {
    const r = calcDailyHours(at('2026-06-01T06:00:00Z'), at('2026-06-01T14:00:00Z'))
    expect(r.totalHours).toBe(8)
    expect(r.regularHours).toBe(8)
    expect(r.overtimeHours).toBe(0)
  })

  it('10h → 8 regular + 2 OT', () => {
    const r = calcDailyHours(at('2026-06-01T06:00:00Z'), at('2026-06-01T16:00:00Z'))
    expect(r.regularHours).toBe(8)
    expect(r.overtimeHours).toBe(2)
  })

  it('short 6h → 6 regular, no OT', () => {
    const r = calcDailyHours(at('2026-06-01T06:00:00Z'), at('2026-06-01T12:00:00Z'))
    expect(r.regularHours).toBe(6)
    expect(r.overtimeHours).toBe(0)
  })

  it('handles a shift crossing midnight', () => {
    const r = calcDailyHours(at('2026-06-01T22:00:00Z'), at('2026-06-02T06:00:00Z'))
    expect(r.totalHours).toBe(8)
  })
})

describe('calcWeeklyOT', () => {
  it('moves regular hours beyond 40/week into OT', () => {
    const records: WeeklyRecord[] = Array.from({ length: 6 }, (_, i) => ({
      work_date: `2026-06-0${i + 1}`,
      regular_hours: 8,
      overtime_hours: 0,
      pto_hours: 0,
      fmla_hours: 0,
    }))
    const out = calcWeeklyOT(records)
    const totalRegular = out.reduce((n, r) => n + r.regular_hours, 0)
    const totalOT = out.reduce((n, r) => n + r.overtime_hours, 0)
    expect(totalRegular).toBe(40)
    expect(totalOT).toBe(8) // the 48th-40th hour becomes OT
  })

  it('leaves a sub-40 week untouched', () => {
    const records: WeeklyRecord[] = [
      { work_date: '2026-06-01', regular_hours: 8, overtime_hours: 0, pto_hours: 0, fmla_hours: 0 },
      { work_date: '2026-06-02', regular_hours: 8, overtime_hours: 0, pto_hours: 0, fmla_hours: 0 },
    ]
    const out = calcWeeklyOT(records)
    expect(out.reduce((n, r) => n + r.overtime_hours, 0)).toBe(0)
  })
})

describe('buildPayrollCSV', () => {
  it('emits a header and escapes commas', () => {
    const rows: PayrollRow[] = [{
      employee_name: 'Doe, John',
      employee_id: 'E1',
      period_start: '2026-06-01',
      period_end: '2026-06-14',
      work_date: '2026-06-01',
      regular_hours: 8,
      overtime_hours: 0,
      pto_hours: 0,
      fmla_hours: 0,
      total_paid_hours: 8,
      missed_breaks: 0,
      is_incomplete: false,
    }]
    const csv = buildPayrollCSV(rows)
    const [header, line] = csv.split('\n')
    expect(header.startsWith('employee_name,employee_id')).toBe(true)
    expect(line).toContain('"Doe, John"') // comma-containing field is quoted
  })
})

describe('shouldRaiseFatigueAlert', () => {
  it('fires at 10h, not at 9.99h', () => {
    expect(shouldRaiseFatigueAlert(10)).toBe(true)
    expect(shouldRaiseFatigueAlert(9.99)).toBe(false)
  })
})
