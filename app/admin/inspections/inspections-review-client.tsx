'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
  damage_drawing: Array<{ type: string; data: string }> | null
  driver: { first_name: string; last_name: string } | null
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white">Inspections</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => navigate({ date: e.target.value, page: 1 })}
            className="bg-gray-900 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm"
          />
          <select
            value={typeFilter}
            onChange={(e) => navigate({ type: e.target.value, page: 1 })}
            className="bg-gray-900 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm"
          >
            <option value="">All Types</option>
            <option value="pre_trip">Pre-Trip</option>
            <option value="post_trip">Post-Trip</option>
          </select>
        </div>
      </div>

      <p className="text-gray-500 text-sm">{total} inspection{total !== 1 ? 's' : ''}</p>

      {inspections.length === 0 && (
        <p className="text-gray-600 text-sm">No inspections found for this date/type.</p>
      )}

      {inspections.map((insp) => {
        const isExpanded = expanded === insp.id
        const failCount = insp.inspection_items.filter((i) => i.passed === false).length
        const passCount = insp.inspection_items.filter((i) => i.passed === true).length
        const damageImages = (insp.damage_drawing ?? []).filter((d) => d.type === 'image' && d.data)

        return (
          <div key={insp.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <button
              className="w-full text-left p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
              onClick={() => setExpanded(isExpanded ? null : insp.id)}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-3">
                  <span className="text-white font-semibold">
                    {insp.driver ? `${insp.driver.first_name} ${insp.driver.last_name}` : 'Unknown Driver'}
                  </span>
                  <span className="text-gray-400 text-sm">Bus {insp.bus?.bus_number ?? '—'}</span>
                </div>
                <p className="text-gray-500 text-xs">
                  {insp.inspection_type === 'pre_trip' ? 'Pre-Trip' : 'Post-Trip'} ·{' '}
                  {insp.submitted_at
                    ? new Date(insp.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Not submitted'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {insp.has_defects && (
                  <span className="text-xs px-2 py-1 rounded-full bg-red-900 text-red-300 font-medium">
                    Defects
                  </span>
                )}
                {damageImages.length > 0 && (
                  <span className="text-xs px-2 py-1 rounded-full bg-orange-900 text-orange-300 font-medium">
                    Damage
                  </span>
                )}
                {insp.is_locked && (
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-400 font-medium">
                    Locked
                  </span>
                )}
                <span className="text-gray-500 text-lg">{isExpanded ? '▲' : '▼'}</span>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-gray-800 p-4 space-y-4">
                {/* Checklist summary */}
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">
                    Checklist ({passCount} pass / {failCount} fail / {insp.inspection_items.length} total)
                  </p>
                  {failCount > 0 && (
                    <div className="space-y-1">
                      {insp.inspection_items
                        .filter((i) => i.passed === false)
                        .map((item) => (
                          <div key={item.id} className="flex items-center gap-2 text-sm">
                            <span className="text-red-500">✗</span>
                            <span className="text-red-300">{item.item_name}</span>
                          </div>
                        ))}
                    </div>
                  )}
                  {failCount === 0 && insp.inspection_items.length > 0 && (
                    <p className="text-green-400 text-sm">All items passed</p>
                  )}
                  {insp.inspection_items.length === 0 && (
                    <p className="text-gray-600 text-sm">No checklist items recorded</p>
                  )}
                </div>

                {/* Damage drawing */}
                {damageImages.length > 0 && (
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Damage Markings</p>
                    <div className="flex flex-wrap gap-3">
                      {damageImages.map((img, idx) => (
                        <img
                          key={idx}
                          src={img.data}
                          alt={`Damage drawing ${idx + 1}`}
                          className="rounded-lg border border-gray-700 max-w-xs"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            disabled={page <= 1}
            onClick={() => navigate({ page: page - 1 })}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-gray-400 text-sm">Page {page} of {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => navigate({ page: page + 1 })}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
