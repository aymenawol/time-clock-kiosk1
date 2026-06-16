// N11 — structured damage drawing model.
//
// Damage is stored as an array of vector strokes (not a flattened PNG) so it can
// be re-rendered crisply at any size and shown in the technician/admin review.
// Coordinates are NORMALISED to 0..1 within each diagram so they are resolution-
// independent. Each stroke is tagged with the diagram VIEW it belongs to, which
// is what gives us "multiple diagrams" (front / rear / driver side / curb side).

export type DamageView = 'front' | 'rear' | 'driver_side' | 'curb_side'

export const DAMAGE_VIEWS: { key: DamageView; label: string }[] = [
  { key: 'front',       label: 'Front' },
  { key: 'rear',        label: 'Rear' },
  { key: 'driver_side', label: 'Driver Side' },
  { key: 'curb_side',   label: 'Curb Side' },
]

export interface DamagePoint { x: number; y: number } // normalised 0..1

export interface DamageStroke {
  view: DamageView
  color: string
  width: number       // px at the 0..1 → 400px reference scale
  opacity: number
  points: DamagePoint[]
}

export type DamageDrawing = DamageStroke[]

/** Reference render box; strokes are normalised against this and scaled at draw time. */
export const DAMAGE_REF_W = 400
export const DAMAGE_REF_H = 200

/** Build an SVG path "d" string from a stroke, scaled to a target box. */
export function strokePath(stroke: DamageStroke, w = DAMAGE_REF_W, h = DAMAGE_REF_H): string {
  if (stroke.points.length === 0) return ''
  return stroke.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(p.x * w).toFixed(1)} ${(p.y * h).toFixed(1)}`)
    .join(' ')
}

/**
 * Backwards-compatible reader: older inspections stored a single PNG as
 * `[{ type: 'image', data: dataURL }]`. Returns the structured strokes, or null
 * when the record is a legacy image (the readonly view falls back to the image).
 */
export function parseDamageStrokes(raw: unknown): DamageStroke[] | null {
  if (!Array.isArray(raw)) return null
  if (raw.length === 0) return []
  const first = raw[0] as Record<string, unknown>
  if (first && first.type === 'image') return null // legacy PNG payload
  return raw.filter(
    (s): s is DamageStroke =>
      !!s && Array.isArray((s as DamageStroke).points) && typeof (s as DamageStroke).view === 'string'
  )
}

/** Extract a legacy single PNG data URL if present, else null. */
export function parseLegacyDamageImage(raw: unknown): string | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const first = raw[0] as Record<string, unknown>
  return first?.type === 'image' && typeof first.data === 'string' ? first.data : null
}

export function strokesForView(strokes: DamageStroke[], view: DamageView): DamageStroke[] {
  return strokes.filter((s) => s.view === view)
}
