'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, X, Check } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import DamageStrokesView from '@/components/damage-strokes-view'
import { parseDamageStrokes, parseLegacyDamageImage } from '@/lib/damage'

interface InspectionItem {
  id: string
  item_name: string
  passed: boolean | null
}

interface Inspection {
  id: string
  inspection_type: string
  inspection_date: string
  is_locked: boolean
  submitted_at: string | null
  has_defects: boolean
  damage_drawing: unknown
  driver: { name: string } | null
  bus: { bus_number: string } | null
  inspection_items: InspectionItem[]
}

export default function InspectionsReviewClient({
  inspections,
  dateFilter,
  typeFilter,
  page,
  pageSize,
  total,
}: {
  inspections: Inspection[]
  dateFilter: string
  typeFilter: string
  page: number
  pageSize: number
  total: number
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<string | null>(null)
  const totalPages = Math.ceil(total / pageSize)

  function navigate(updates: Record<string, string | number>) {
    const params = new URLSearchParams({
      date: dateFilter,
      type: typeFilter,
      page: String(page),
      ...Object.fromEntries(Object.entries(updates).map(([k, v]) => [k, String(v)])),
    })
    if (!params.get('type')) params.delete('type')
    router.push(`/admin/inspections?${params.toString()}`)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-foreground">Inspections</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => navigate({ date: e.target.value, page: 1 })}
            className="h-9 w-auto text-sm"
          />
          <select
            value={typeFilter}
            onChange={(e) => navigate({ type: e.target.value, page: 1 })}
            className="h-9 rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          >
            <option value="">All Types</option>
            <option value="pre_trip">Pre-Trip</option>
            <option value="post_trip">Post-Trip</option>
          </select>
        </div>
      </div>

      <p className="text-muted-foreground text-sm">{total} inspection{total !== 1 ? 's' : ''}</p>

      {inspections.length === 0 && (
        <p className="text-muted-foreground text-sm">No inspections found for this date/type.</p>
      )}

      {inspections.map((insp) => {
        const isExpanded = expanded === insp.id
        const failCount = insp.inspection_items.filter((i) => i.passed === false).length
        const passCount = insp.inspection_items.filter((i) => i.passed === true).length
        const strokes = parseDamageStrokes(insp.damage_drawing)
        const hasDamage = (strokes?.length ?? 0) > 0 || parseLegacyDamageImage(insp.damage_drawing) !== null

        return (
          <Card key={insp.id} className="overflow-hidden p-0">
            <button
              className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-muted/50 transition-colors"
              onClick={() => setExpanded(isExpanded ? null : insp.id)}
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-foreground font-semibold truncate">
                    {insp.driver ? insp.driver.name : 'Unknown Driver'}
                  </span>
                  <span className="text-muted-foreground text-sm shrink-0">Bus {insp.bus?.bus_number ?? '—'}</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {insp.inspection_type === 'pre_trip' ? 'Pre-Trip' : 'Post-Trip'} ·{' '}
                  {insp.submitted_at
                    ? new Date(insp.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Not submitted'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                {insp.has_defects && (
                  <Badge variant="danger">Defects</Badge>
                )}
                {hasDamage && (
                  <Badge variant="warn">Damage</Badge>
                )}
                {insp.is_locked && (
                  <Badge variant="neutral">Locked</Badge>
                )}
                {isExpanded
                  ? <ChevronUp className="size-4 text-muted-foreground" />
                  : <ChevronDown className="size-4 text-muted-foreground" />}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-border p-4 space-y-4">
                {/* Checklist summary */}
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-2">
                    Checklist ({passCount} pass / {failCount} fail / {insp.inspection_items.length} total)
                  </p>
                  {failCount > 0 && (
                    <div className="space-y-1">
                      {insp.inspection_items
                        .filter((i) => i.passed === false)
                        .map((item) => (
                          <div key={item.id} className="flex items-center gap-2 text-sm">
                            <X className="size-4 text-danger shrink-0" />
                            <span className="text-danger">{item.item_name}</span>
                          </div>
                        ))}
                    </div>
                  )}
                  {failCount === 0 && insp.inspection_items.length > 0 && (
                    <p className="text-ok text-sm flex items-center gap-2"><Check className="size-4" /> All items passed</p>
                  )}
                  {insp.inspection_items.length === 0 && (
                    <p className="text-muted-foreground text-sm">No checklist items recorded</p>
                  )}
                </div>

                {/* Damage drawing — structured strokes per diagram view (N11) */}
                {hasDamage && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-2">Damage Markings</p>
                    <DamageStrokesView drawing={insp.damage_drawing} />
                  </div>
                )}
              </div>
            )}
          </Card>
        )
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => navigate({ page: page - 1 })}
          >
            <ChevronLeft /> Prev
          </Button>
          <span className="text-muted-foreground text-sm">Page {page} of {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => navigate({ page: page + 1 })}
          >
            Next <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  )
}
