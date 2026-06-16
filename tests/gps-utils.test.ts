import { describe, it, expect } from 'vitest'
import {
  haversineMeters,
  calcETA,
  getTerminalCongestion,
  isPositionStale,
  minutesSinceLastPosition,
  type PositionSample,
  type BusPositionPoint,
} from '@/lib/gps-utils'
import { TERMINALS } from '@/lib/terminals'

const T1 = TERMINALS[0]

describe('haversineMeters', () => {
  it('is zero for the same point', () => {
    expect(haversineMeters(T1.lat, T1.lng, T1.lat, T1.lng)).toBe(0)
  })

  it('~111km per degree of latitude', () => {
    const d = haversineMeters(36, -115, 37, -115)
    expect(d).toBeGreaterThan(110_000)
    expect(d).toBeLessThan(112_000)
  })
})

describe('calcETA', () => {
  it('returns null with no samples', () => {
    expect(calcETA([], T1)).toBeNull()
  })

  it('returns null when stationary (speed 0)', () => {
    const pos: PositionSample[] = [{ lat: 36.05, lng: -115.15, recorded_at: '2026-06-01T00:00:00Z', speed: 0 }]
    expect(calcETA(pos, T1)).toBeNull()
  })

  it('returns positive minutes when moving', () => {
    const pos: PositionSample[] = [{ lat: 36.05, lng: -115.15, recorded_at: '2026-06-01T00:00:00Z', speed: 40 }]
    const eta = calcETA(pos, T1)
    expect(eta).not.toBeNull()
    expect(eta as number).toBeGreaterThan(0)
  })
})

describe('getTerminalCongestion', () => {
  const near = (n: number): BusPositionPoint[] =>
    Array.from({ length: n }, (_, i) => ({ bus_id: `b${i}`, lat: T1.lat, lng: T1.lng, recorded_at: '2026-06-01T00:00:00Z' }))

  it('green when below yellow threshold', () => {
    expect(getTerminalCongestion(near(1), T1)).toBe('green')
  })
  it('yellow at 2 nearby', () => {
    expect(getTerminalCongestion(near(2), T1)).toBe('yellow')
  })
  it('red at 3+ nearby', () => {
    expect(getTerminalCongestion(near(3), T1)).toBe('red')
  })
  it('green when buses are far away', () => {
    const far: BusPositionPoint[] = [{ bus_id: 'x', lat: 40, lng: -100, recorded_at: '2026-06-01T00:00:00Z' }]
    expect(getTerminalCongestion(far, T1)).toBe('green')
  })
})

describe('staleness', () => {
  it('fresh position is not stale', () => {
    expect(isPositionStale(new Date().toISOString())).toBe(false)
  })
  it('old position is stale', () => {
    expect(isPositionStale(new Date(Date.now() - 5 * 60_000).toISOString())).toBe(true)
    expect(minutesSinceLastPosition(new Date(Date.now() - 5 * 60_000).toISOString())).toBeGreaterThanOrEqual(5)
  })
})
