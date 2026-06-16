import { describe, it, expect } from 'vitest'
import {
  isoWeekKey, daysWorkedByWeek, maxDaysInAnyWeek, weeklyOtHours,
  WEEKLY_DAYS_LIMIT,
} from '@/lib/payroll-calc'
import { calcNearestTerminalEta } from '@/lib/gps-utils'
import { parseDamageStrokes, parseLegacyDamageImage, strokePath } from '@/lib/damage'
import type { Terminal } from '@/lib/terminals'

describe('N8 — weekly fatigue helpers', () => {
  it('isoWeekKey groups consecutive days into the same week', () => {
    // 2026-06-01 (Mon) .. 2026-06-07 (Sun) are all ISO week 23
    expect(isoWeekKey('2026-06-01')).toBe(isoWeekKey('2026-06-07'))
    // 2026-06-08 (Mon) is the next week
    expect(isoWeekKey('2026-06-08')).not.toBe(isoWeekKey('2026-06-07'))
  })

  it('counts distinct days per week and finds the peak', () => {
    const dates = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-06', '2026-06-08']
    const byWeek = daysWorkedByWeek(dates)
    expect(byWeek[isoWeekKey('2026-06-01')]).toBe(6)
    expect(maxDaysInAnyWeek(dates)).toBe(6)
    expect(maxDaysInAnyWeek(dates) > WEEKLY_DAYS_LIMIT).toBe(true)
  })

  it('dedupes repeated dates', () => {
    expect(maxDaysInAnyWeek(['2026-06-01', '2026-06-01', '2026-06-02'])).toBe(2)
  })

  it('sums weekly OT hours', () => {
    const recs = [
      { work_date: '2026-06-01', overtime_hours: 2 },
      { work_date: '2026-06-02', overtime_hours: 3 },
      { work_date: '2026-06-08', overtime_hours: 1 },
    ]
    const ot = weeklyOtHours(recs)
    expect(ot[isoWeekKey('2026-06-01')]).toBe(5)
    expect(ot[isoWeekKey('2026-06-08')]).toBe(1)
  })
})

describe('N9 — nearest-terminal ETA', () => {
  const terminals: Terminal[] = [
    { id: 't1', code: 'T1', name: 'Terminal 1', lat: 36.084, lng: -115.152, radiusMeters: 200 },
    { id: 't3', code: 'T3', name: 'Terminal 3', lat: 36.090, lng: -115.160, radiusMeters: 200 },
  ]

  it('returns null without usable speed', () => {
    const r = calcNearestTerminalEta([{ lat: 36.0, lng: -115.0, recorded_at: '2026-06-01T00:00:00Z', speed: 0 }], terminals)
    expect(r).toBeNull()
  })

  it('picks the closer terminal and a positive ETA', () => {
    const r = calcNearestTerminalEta(
      [{ lat: 36.083, lng: -115.151, recorded_at: '2026-06-01T00:00:00Z', speed: 40 }],
      terminals
    )
    expect(r).not.toBeNull()
    expect(r!.terminal.code).toBe('T1')
    expect(r!.etaMin).toBeGreaterThanOrEqual(0)
  })

  it('returns null with no terminals', () => {
    expect(calcNearestTerminalEta([{ lat: 36, lng: -115, recorded_at: 'x', speed: 30 }], [])).toBeNull()
  })
})

describe('N11 — damage stroke parsing', () => {
  it('reads structured strokes', () => {
    const raw = [{ view: 'front', color: '#f00', width: 2, opacity: 1, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }]
    const strokes = parseDamageStrokes(raw)
    expect(strokes).not.toBeNull()
    expect(strokes!.length).toBe(1)
    expect(parseLegacyDamageImage(raw)).toBeNull()
  })

  it('detects legacy PNG payload', () => {
    const raw = [{ type: 'image', data: 'data:image/png;base64,AAAA' }]
    expect(parseDamageStrokes(raw)).toBeNull()
    expect(parseLegacyDamageImage(raw)).toBe('data:image/png;base64,AAAA')
  })

  it('empty array is empty structured strokes', () => {
    expect(parseDamageStrokes([])).toEqual([])
  })

  it('builds a scaled SVG path', () => {
    const d = strokePath({ view: 'front', color: '#000', width: 2, opacity: 1, points: [{ x: 0, y: 0 }, { x: 1, y: 0.5 }] }, 400, 200)
    expect(d).toBe('M 0.0 0.0 L 400.0 100.0')
  })
})
