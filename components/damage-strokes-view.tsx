'use client'

import {
  DAMAGE_VIEWS, DAMAGE_REF_W, DAMAGE_REF_H, strokePath, strokesForView,
  parseDamageStrokes, parseLegacyDamageImage,
} from '@/lib/damage'

/**
 * N11 — read-only render of structured damage strokes, one small panel per
 * diagram view. Falls back to the legacy flattened PNG for older inspections.
 * Used in the technician / admin inspection review.
 */
export default function DamageStrokesView({ drawing }: { drawing: unknown }) {
  const strokes = parseDamageStrokes(drawing)

  if (strokes === null) {
    const img = parseLegacyDamageImage(drawing)
    if (img) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={img} alt="Damage diagram" loading="lazy" decoding="async" className="w-full border border-border rounded bg-background" />
    }
    return <p className="text-muted-foreground text-xs">No damage diagram recorded.</p>
  }

  if (strokes.length === 0) {
    return <p className="text-muted-foreground text-xs">No damage marked.</p>
  }

  const viewsWithMarks = DAMAGE_VIEWS.filter((v) => strokesForView(strokes, v.key).length > 0)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {viewsWithMarks.map((v) => (
        <div key={v.key}>
          <p className="text-muted-foreground text-xs mb-1">{v.label}</p>
          <svg viewBox={`0 0 ${DAMAGE_REF_W} ${DAMAGE_REF_H}`} className="w-full border border-border rounded bg-background" xmlns="http://www.w3.org/2000/svg">
            <rect x="20" y="30" width="360" height="140" rx="14" fill="none" stroke="#4b5563" strokeWidth="2" />
            <line x1="20" y1="60" x2="380" y2="60" stroke="#374151" strokeWidth="1" />
            {strokesForView(strokes, v.key).map((s, i) => (
              <path key={i} d={strokePath(s)} fill="none" stroke={s.color} strokeOpacity={s.opacity}
                strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </svg>
        </div>
      ))}
    </div>
  )
}
