import { describe, it, expect } from 'vitest'
import { PostOtShiftSchema, OffDayRequestSchema } from '@/lib/schemas/overtime'

// These guard the dispatcher overtime / off-day FormData actions (audit M-5).
// Before the schemas, `Number('abc') → NaN` and negative/huge values reached
// the DB unchecked.

describe('PostOtShiftSchema', () => {
  const valid = {
    date: '2026-06-20',
    start_time: '08:00',
    duration_hours: 6,
    slots_available: 2,
    description: null,
    bid_close_at: null,
  }

  it('accepts a well-formed overtime shift', () => {
    expect(PostOtShiftSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects NaN duration (from Number("abc"))', () => {
    expect(PostOtShiftSchema.safeParse({ ...valid, duration_hours: Number('abc') }).success).toBe(false)
  })

  it('rejects non-positive or oversized duration', () => {
    expect(PostOtShiftSchema.safeParse({ ...valid, duration_hours: 0 }).success).toBe(false)
    expect(PostOtShiftSchema.safeParse({ ...valid, duration_hours: -3 }).success).toBe(false)
    expect(PostOtShiftSchema.safeParse({ ...valid, duration_hours: 25 }).success).toBe(false)
  })

  it('rejects slots < 1 and non-integer slots', () => {
    expect(PostOtShiftSchema.safeParse({ ...valid, slots_available: 0 }).success).toBe(false)
    expect(PostOtShiftSchema.safeParse({ ...valid, slots_available: 1.5 }).success).toBe(false)
  })

  it('rejects malformed date and time', () => {
    expect(PostOtShiftSchema.safeParse({ ...valid, date: '06/20/2026' }).success).toBe(false)
    expect(PostOtShiftSchema.safeParse({ ...valid, start_time: '8am' }).success).toBe(false)
  })

  it('accepts HH:MM:SS time form', () => {
    expect(PostOtShiftSchema.safeParse({ ...valid, start_time: '08:00:00' }).success).toBe(true)
  })
})

describe('OffDayRequestSchema', () => {
  const valid = {
    employee_id: '11111111-1111-1111-1111-111111111111',
    requested_date: '2026-06-20',
    message: null,
  }

  it('accepts a valid request', () => {
    expect(OffDayRequestSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects a non-UUID employee id', () => {
    expect(OffDayRequestSchema.safeParse({ ...valid, employee_id: '123' }).success).toBe(false)
  })

  it('rejects a malformed date', () => {
    expect(OffDayRequestSchema.safeParse({ ...valid, requested_date: 'tomorrow' }).success).toBe(false)
  })
})
