'use client'

import { useRef, useState } from 'react'
import {
  DAMAGE_VIEWS, DAMAGE_REF_W, DAMAGE_REF_H, strokePath, strokesForView,
  type DamageView, type DamageStroke, type DamagePoint,
} from '@/lib/damage'

const DAMAGE_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#22c55e']
const TOOLS = [
  { key: 'pen',         label: 'Pen',       width: 2,  opacity: 1 },
  { key: 'marker',      label: 'Marker',    width: 6,  opacity: 1 },
  { key: 'highlighter', label: 'Highlight', width: 14, opacity: 0.5 },
] as const
type ToolKey = (typeof TOOLS)[number]['key']

/** Simple labelled outline per diagram view. */
function ViewOutline({ view }: { view: DamageView }) {
  const label = DAMAGE_VIEWS.find((v) => v.key === view)?.label ?? ''
  return (
    <svg viewBox={`0 0 ${DAMAGE_REF_W} ${DAMAGE_REF_H}`} className="w-full" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="30" width="360" height="140" rx="14" fill="none" stroke="#4b5563" strokeWidth="2" />
      <line x1="20" y1="60" x2="380" y2="60" stroke="#374151" strokeWidth="1" />
      <text x="200" y="22" textAnchor="middle" fill="#6b7280" fontSize="12" fontFamily="sans-serif">
        {label.toUpperCase()} VIEW
      </text>
    </svg>
  )
}

/**
 * N11 — editable multi-view damage board. Captures freehand strokes as
 * normalised vector paths per diagram view (controlled via value/onChange).
 */
export default function DamageBoard({
  value,
  onChange,
  disabled = false,
}: {
  value: DamageStroke[]
  onChange: (strokes: DamageStroke[]) => void
  disabled?: boolean
}) {
  const [view, setView] = useState<DamageView>('front')
  const [color, setColor] = useState(DAMAGE_COLORS[0])
  const [tool, setTool] = useState<ToolKey>('pen')
  const [drawing, setDrawing] = useState<DamagePoint[] | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const toolDef = TOOLS.find((t) => t.key === tool)!
  const viewStrokes = strokesForView(value, view)

  function pos(e: React.MouseEvent | React.TouchEvent): DamagePoint | null {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const src = 'touches' in e ? e.touches[0] : (e as React.MouseEvent)
    if (!src) return null
    return {
      x: Math.min(1, Math.max(0, (src.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (src.clientY - rect.top) / rect.height)),
    }
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    if (disabled) return
    const p = pos(e)
    if (p) setDrawing([p])
  }
  function move(e: React.MouseEvent | React.TouchEvent) {
    if (disabled || !drawing) return
    const p = pos(e)
    if (p) setDrawing((prev) => (prev ? [...prev, p] : [p]))
  }
  function end() {
    if (!drawing) return
    if (drawing.length >= 2) {
      onChange([...value, { view, color, width: toolDef.width, opacity: toolDef.opacity, points: drawing }])
    }
    setDrawing(null)
  }
  function undo() {
    // Remove the last stroke belonging to the active view.
    const lastIdx = (() => { for (let i = value.length - 1; i >= 0; i--) if (value[i].view === view) return i; return -1 })()
    if (lastIdx >= 0) onChange(value.filter((_, i) => i !== lastIdx))
  }
  function clearView() {
    onChange(value.filter((s) => s.view !== view))
  }

  const liveStroke: DamageStroke | null = drawing
    ? { view, color, width: toolDef.width, opacity: toolDef.opacity, points: drawing }
    : null

  return (
    <div className="space-y-2">
      {/* View tabs */}
      <div className="flex flex-wrap gap-1">
        {DAMAGE_VIEWS.map((v) => {
          const count = strokesForView(value, v.key).length
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                view === v.key ? 'bg-blue-600 border-blue-500 text-foreground' : 'bg-muted border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {v.label}{count > 0 ? ` (${count})` : ''}
            </button>
          )
        })}
      </div>

      {/* Tools */}
      <div className="flex flex-wrap gap-1 items-center">
        {TOOLS.map((t) => (
          <button
            key={t.key}
            type="button"
            disabled={disabled}
            onClick={() => setTool(t.key)}
            className={`text-xs px-2.5 py-1 rounded border transition-colors ${
              tool === t.key ? 'bg-blue-600 border-blue-500 text-foreground' : 'bg-muted border-border text-muted-foreground hover:text-foreground'
            } disabled:opacity-50`}
          >{t.label}</button>
        ))}
        <button type="button" disabled={disabled || viewStrokes.length === 0} onClick={undo}
          className="text-xs px-2.5 py-1 rounded border border-border bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 ml-auto">Undo</button>
        <button type="button" disabled={disabled || viewStrokes.length === 0} onClick={clearView}
          className="text-xs px-2 py-1 rounded border border-border bg-muted text-muted-foreground hover:text-red-300 hover:border-red-700 disabled:opacity-30">Clear</button>
      </div>
      <div className="flex gap-2">
        {DAMAGE_COLORS.map((c) => (
          <button key={c} type="button" disabled={disabled} onClick={() => setColor(c)}
            className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110' : 'border-transparent opacity-70'}`}
            style={{ backgroundColor: c }} />
        ))}
      </div>

      {/* Drawing surface */}
      <div className="relative">
        <ViewOutline view={view} />
        <svg
          ref={svgRef}
          viewBox={`0 0 ${DAMAGE_REF_W} ${DAMAGE_REF_H}`}
          className="absolute inset-0 w-full h-full touch-none"
          style={{ cursor: disabled ? 'default' : 'crosshair', pointerEvents: disabled ? 'none' : 'auto' }}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        >
          {[...viewStrokes, ...(liveStroke ? [liveStroke] : [])].map((s, i) => (
            <path key={i} d={strokePath(s)} fill="none" stroke={s.color} strokeOpacity={s.opacity}
              strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </svg>
      </div>
      <p className="text-gray-600 text-xs">Mark damage on each view. Strokes are saved per diagram.</p>
    </div>
  )
}
