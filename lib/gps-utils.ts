import type { Terminal } from './terminals'

// ─────────────────────────────────────────────────────────────
// Haversine formula
// ─────────────────────────────────────────────────────────────

/**
 * Returns the great-circle distance between two coordinates in METRES.
 */
export function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000 // Earth radius in metres
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg: number) { return (deg * Math.PI) / 180 }

// ─────────────────────────────────────────────────────────────
// ETA calculation
// ─────────────────────────────────────────────────────────────

export interface PositionSample {
  lat: number
  lng: number
  recorded_at: string // ISO timestamp
  speed?: number | null // km/h
}

/**
 * Returns estimated time of arrival (in minutes) to the given terminal.
 * Uses a rolling-average of the last `windowSize` speed samples.
 * Returns null when speed is 0 or data is insufficient.
 */
export function calcETA(
  positions: PositionSample[],
  terminal: Terminal,
  windowSize = 3,
): number | null {
  if (positions.length === 0) return null

  const latest = positions[0]
  const distanceM = haversineMeters(latest.lat, latest.lng, terminal.lat, terminal.lng)

  // Rolling average speed from last `windowSize` samples
  const samples = positions.slice(0, windowSize).filter(p => (p.speed ?? 0) > 0)
  if (samples.length === 0) return null

  const avgSpeedKph = samples.reduce((sum, p) => sum + (p.speed ?? 0), 0) / samples.length
  if (avgSpeedKph < 1) return null

  const avgSpeedMps = (avgSpeedKph * 1000) / 3600
  const seconds = distanceM / avgSpeedMps
  return Math.round(seconds / 60)
}

// ─────────────────────────────────────────────────────────────
// Congestion detection
// ─────────────────────────────────────────────────────────────

export interface BusPositionPoint {
  bus_id: string
  lat: number
  lng: number
  recorded_at: string
}

/** @returns 'green' | 'yellow' | 'red' based on how many buses are near the terminal */
export function getTerminalCongestion(
  latestPositions: BusPositionPoint[],
  terminal: Terminal,
  yellowThreshold = 2,
  redThreshold = 3,
): 'green' | 'yellow' | 'red' {
  const nearby = latestPositions.filter(
    p => haversineMeters(p.lat, p.lng, terminal.lat, terminal.lng) <= terminal.radiusMeters,
  )
  if (nearby.length >= redThreshold) return 'red'
  if (nearby.length >= yellowThreshold) return 'yellow'
  return 'green'
}

// ─────────────────────────────────────────────────────────────
// Staleness helpers
// ─────────────────────────────────────────────────────────────

/** Returns true if the position is older than `thresholdSeconds` seconds */
export function isPositionStale(recordedAt: string, thresholdSeconds = 60): boolean {
  return (Date.now() - new Date(recordedAt).getTime()) > thresholdSeconds * 1000
}

/** Returns minutes since last recorded position */
export function minutesSinceLastPosition(recordedAt: string): number {
  return Math.floor((Date.now() - new Date(recordedAt).getTime()) / 60_000)
}
