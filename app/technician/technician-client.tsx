'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface Bus {
  id: string; bus_number: string; bus_type: string; status: string; fuel_level: number | null
}
interface RepairNote {
  id: string; notes: string; photo_urls: string[] | null; is_resolved: boolean
  resolved_at: string | null; created_at: string
  defect_category: string | null; defect_item: string | null
  bus: { id: string; bus_number: string; bus_type: string; status: string } | null
  inspection: { id: string; inspection_type: string; inspection_date: string; driver_id: string } | null
}

interface Props {
  initialRepairNotes: RepairNote[]
  buses: Bus[]
}

const BUS_STATUS_READY = ['ready', 'in_service', 'charging'] as const

export default function TechnicianClient({ initialRepairNotes, buses }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  // Add repair note form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ bus_id: '', defect_category: '', defect_item: '', notes: '' })

  // Group open defects by bus
  const byBus: Record<string, { bus: RepairNote['bus']; notes: RepairNote[] }> = {}
  for (const n of initialRepairNotes) {
    const key = n.bus?.id ?? 'unknown'
    if (!byBus[key]) byBus[key] = { bus: n.bus, notes: [] }
    byBus[key].notes.push(n)
  }

  async function markResolved(noteId: string, busId: string | null, markReady: boolean) {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { error: err } = await supabase
      .from('repair_notes')
      .update({ is_resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', noteId)
    if (err) { setError(err.message); return }

    if (markReady && busId) {
      await supabase.from('buses').update({ status: 'ready' }).eq('id', busId)
    }
    router.refresh()
  }

  function handleMarkResolved(note: RepairNote) {
    const busHasOthers = initialRepairNotes.filter(n => n.bus?.id === note.bus?.id && n.id !== note.id).length > 0
    const offerReady   = note.bus && !busHasOthers && !BUS_STATUS_READY.includes(note.bus.status as any)
    const markReady    = offerReady ? confirm(`Also mark Bus #${note.bus!.bus_number} as Ready?`) : false
    startTransition(() => markResolved(note.id, note.bus?.id ?? null, markReady))
  }

  async function handleAddNote() {
    if (!form.bus_id || !form.notes) { setError('Bus and notes are required.'); return }
    setError('')
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { error: err } = await supabase.from('repair_notes').insert({
      bus_id:          form.bus_id,
      defect_category: form.defect_category || null,
      defect_item:     form.defect_item || null,
      notes:           form.notes,
      is_resolved:     false,
    })
    if (err) { setError(err.message); return }
    setForm({ bus_id: '', defect_category: '', defect_item: '', notes: '' })
    setShowForm(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Open Defects</h1>
        <div className="flex items-center gap-2">
          <span className="bg-red-950 text-red-300 border border-red-800 text-sm font-semibold px-3 py-1 rounded-full">
            {initialRepairNotes.length} open
          </span>
          <button
            onClick={() => setShowForm(v => !v)}
            className="bg-blue-700 hover:bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg"
          >
            + Log Defect
          </button>
        </div>
      </div>

      {error && <div className="bg-red-900/40 border border-red-600 text-red-300 rounded p-3 text-sm">{error}</div>}

      {/* Add defect form */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-300">Log New Defect</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Bus *</label>
              <select value={form.bus_id} onChange={e => setForm(p => ({...p, bus_id: e.target.value}))} className={SEL}>
                <option value="">Select bus…</option>
                {buses.map(b => (
                  <option key={b.id} value={b.id}>#{b.bus_number} ({b.bus_type}) — {b.status}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Category</label>
              <input
                value={form.defect_category}
                onChange={e => setForm(p => ({...p, defect_category: e.target.value}))}
                placeholder="e.g. Lights"
                className={INP}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Item</label>
              <input
                value={form.defect_item}
                onChange={e => setForm(p => ({...p, defect_item: e.target.value}))}
                placeholder="e.g. Left headlight"
                className={INP}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Notes *</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({...p, notes: e.target.value}))}
              rows={3}
              placeholder="Describe the defect…"
              className={`${INP} resize-none`}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-300 px-3 py-1.5">Cancel</button>
            <button onClick={handleAddNote} disabled={isPending} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg">
              {isPending ? 'Saving…' : 'Log Defect'}
            </button>
          </div>
        </div>
      )}

      {/* No defects */}
      {initialRepairNotes.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <p className="text-green-400 font-semibold text-lg">All Clear!</p>
          <p className="text-gray-600 text-sm mt-1">No open defects.</p>
        </div>
      )}

      {/* Defects grouped by bus */}
      {Object.entries(byBus).map(([busId, group]) => (
        <div key={busId} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-800/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-white font-bold">
                {group.bus ? `Bus #${group.bus.bus_number}` : 'Unknown Bus'}
              </span>
              {group.bus && (
                <span className="text-gray-500 text-xs">{group.bus.bus_type} — {group.bus.status}</span>
              )}
            </div>
            <span className="text-red-400 text-sm font-medium">{group.notes.length} defect{group.notes.length > 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-gray-800">
            {group.notes.map(note => (
              <div key={note.id} className="px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    {(note.defect_category || note.defect_item) && (
                      <p className="text-xs text-gray-500 mb-0.5">
                        {[note.defect_category, note.defect_item].filter(Boolean).join(' / ')}
                      </p>
                    )}
                    <p className="text-white text-sm">{note.notes}</p>
                    <p className="text-gray-600 text-xs mt-1">
                      {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {note.inspection && (
                        <span className="ml-2">via {note.inspection.inspection_type.replace('_', '-')} inspection</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => handleMarkResolved(note)}
                    disabled={isPending}
                    className="bg-green-800 hover:bg-green-700 disabled:opacity-50 text-green-200 text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap"
                  >
                    Mark Resolved
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const INP = 'w-full bg-gray-950 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50 placeholder-gray-700'
const SEL = 'w-full bg-gray-950 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm'
