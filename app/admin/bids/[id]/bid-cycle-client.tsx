'use client'
import { useTransition, useState } from 'react'
import {
  updateCycleStatusAction,
  addSlotAction,
  deleteSlotAction,
  runAwardEngineAction,
  overrideAwardAction,
} from '../actions'
import {
  ShiftBidCycle,
  ShiftBidSlot,
  ShiftBidSubmission,
  ShiftBidAward,
  BID_CYCLE_STATUS_COLOR,
  ROUTE_TYPE_LABELS,
  RouteType,
} from '@/lib/supabase'

interface Props {
  cycle: ShiftBidCycle
  slots: (ShiftBidSlot & { awards: ShiftBidAward[] })[]
  submissions: (ShiftBidSubmission & { employees: { name: string; seniority_number: number | null } | null })[]
  awards: (ShiftBidAward & { employees: { name: string } | null; shift_bid_slots: { bid_number: number } | null })[]
}

type Tab = 'slots' | 'submissions' | 'awards'

const DAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat'] as const
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa']

export default function BidCycleClient({ cycle, slots, submissions, awards }: Props) {
  const [tab, setTab] = useState<Tab>('slots')
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [showSlotForm, setShowSlotForm] = useState(false)

  function statusAction(status: ShiftBidCycle['status']) {
    setErr(null)
    startTransition(async () => {
      try { await updateCycleStatusAction(cycle.id, status) }
      catch (e: any) { setErr(e.message) }
    })
  }

  function handleAddSlot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErr(null)
    startTransition(async () => {
      try { await addSlotAction(cycle.id, fd); setShowSlotForm(false) }
      catch (e: any) { setErr(e.message) }
    })
  }

  function handleDeleteSlot(slotId: string) {
    if (!confirm('Delete this slot?')) return
    setErr(null)
    startTransition(async () => {
      try { await deleteSlotAction(cycle.id, slotId) }
      catch (e: any) { setErr(e.message) }
    })
  }

  function handleRunEngine() {
    if (!confirm('Run seniority award engine? This will assign employees to slots based on seniority.')) return
    setErr(null)
    startTransition(async () => {
      try {
        const result = await runAwardEngineAction(cycle.id)
        alert(`Award engine complete. ${result.awarded} employee(s) awarded.`)
      } catch (e: any) { setErr(e.message) }
    })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <a href="/admin/bids" className="text-sm text-muted-foreground hover:text-foreground mb-1 block">← Bid Cycles</a>
          <h1 className="text-2xl font-bold text-foreground">{cycle.name}</h1>
          {cycle.description && <p className="text-muted-foreground text-sm mt-0.5">{cycle.description}</p>}
          <p className="text-muted-foreground text-xs mt-1">
            Shifts: {cycle.start_date} — {cycle.end_date}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${BID_CYCLE_STATUS_COLOR[cycle.status]}`}>
            {cycle.status}
          </span>
          <div className="flex gap-2">
            {cycle.status === 'draft' && (
              <button onClick={() => statusAction('published')} disabled={pending}
                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-foreground text-xs rounded disabled:opacity-50">
                Publish
              </button>
            )}
            {cycle.status === 'published' && (
              <button onClick={() => statusAction('locked')} disabled={pending}
                className="px-3 py-1.5 bg-yellow-700 hover:bg-yellow-600 text-foreground text-xs rounded disabled:opacity-50">
                Lock Submissions
              </button>
            )}
            {cycle.status === 'locked' && (
              <>
                <button onClick={handleRunEngine} disabled={pending}
                  className="px-3 py-1.5 bg-green-700 hover:bg-green-600 text-foreground text-xs rounded disabled:opacity-50">
                  Run Award Engine
                </button>
                <button onClick={() => statusAction('awarded')} disabled={pending}
                  className="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 text-foreground text-xs rounded disabled:opacity-50">
                  Mark Awarded
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {err && <p className="text-red-400 text-sm mb-4 bg-red-900/20 border border-red-800 rounded px-3 py-2">{err}</p>}

      {/* Tabs */}
      <div className="flex border-b border-border mb-6 gap-1">
        {(['slots','submissions','awards'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t ? 'border-b-2 border-blue-500 text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {t} {t === 'slots' ? `(${slots.length})` : t === 'submissions' ? `(${submissions.length})` : `(${awards.length})`}
          </button>
        ))}
      </div>

      {/* ── Slots ────────────────────────────────── */}
      {tab === 'slots' && (
        <div className="space-y-3">
          {cycle.status === 'draft' && (
            <button onClick={() => setShowSlotForm(v => !v)}
              className="px-3 py-1.5 bg-muted hover:bg-gray-700 text-foreground text-xs rounded border border-border">
              {showSlotForm ? 'Cancel' : '+ Add Slot'}
            </button>
          )}

          {showSlotForm && (
            <form onSubmit={handleAddSlot} className="bg-card border border-border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">New Bid Slot</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Bid #</label>
                  <input name="bid_number" type="number" required min={1} className="w-full bg-muted border border-border rounded px-2 py-1.5 text-foreground text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Route Type</label>
                  <select name="route_type" required className="w-full bg-muted border border-border rounded px-2 py-1.5 text-foreground text-sm">
                    {(Object.entries(ROUTE_TYPE_LABELS) as [RouteType, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Report Time</label>
                  <input name="report_time" type="time" required className="w-full bg-muted border border-border rounded px-2 py-1.5 text-foreground text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Shift Start</label>
                  <input name="shift_start" type="time" required className="w-full bg-muted border border-border rounded px-2 py-1.5 text-foreground text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Shift End</label>
                  <input name="shift_end" type="time" required className="w-full bg-muted border border-border rounded px-2 py-1.5 text-foreground text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Max Drivers</label>
                  <input name="max_drivers" type="number" min={1} defaultValue={1} required className="w-full bg-muted border border-border rounded px-2 py-1.5 text-foreground text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Days</label>
                <div className="flex gap-2">
                  {DAY_KEYS.map((d, i) => (
                    <label key={d} className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                      {DAY_LABELS[i]}
                      <input type="checkbox" name={`days_${d}`} value="true" className="accent-blue-600" />
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Notes</label>
                <input name="notes" className="w-full bg-muted border border-border rounded px-2 py-1.5 text-foreground text-sm" />
              </div>
              <button type="submit" disabled={pending}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-foreground text-xs rounded disabled:opacity-50">
                {pending ? 'Adding...' : 'Add Slot'}
              </button>
            </form>
          )}

          {slots.length === 0 ? (
            <p className="text-muted-foreground text-sm">No slots yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs">
                    <th className="text-left py-2 pr-4">Bid #</th>
                    <th className="text-left py-2 pr-4">Route</th>
                    <th className="text-left py-2 pr-4">Report</th>
                    <th className="text-left py-2 pr-4">Start → End</th>
                    <th className="text-left py-2 pr-4">Days</th>
                    <th className="text-left py-2 pr-4">Max</th>
                    <th className="text-left py-2 pr-4">Awards</th>
                    {cycle.status === 'draft' && <th className="py-2"></th>}
                  </tr>
                </thead>
                <tbody>
                  {slots.map(slot => (
                    <tr key={slot.id} className="border-b border-border/50 hover:bg-card/30">
                      <td className="py-2 pr-4 text-foreground font-mono">{slot.bid_number}</td>
                      <td className="py-2 pr-4 text-foreground">{ROUTE_TYPE_LABELS[slot.route_type]}</td>
                      <td className="py-2 pr-4 text-foreground font-mono">{slot.report_time}</td>
                      <td className="py-2 pr-4 text-foreground font-mono">{slot.shift_start} → {slot.shift_end}</td>
                      <td className="py-2 pr-4 text-muted-foreground font-mono text-xs">
                        {DAY_KEYS.map((d, i) => (slot as any)[`days_${d}`] ? DAY_LABELS[i] : '·').join(' ')}
                      </td>
                      <td className="py-2 pr-4 text-foreground">{slot.max_drivers}</td>
                      <td className="py-2 pr-4 text-foreground">{slot.awards?.length ?? 0}</td>
                      {cycle.status === 'draft' && (
                        <td className="py-2">
                          <button onClick={() => handleDeleteSlot(slot.id)}
                            className="text-xs text-red-500 hover:text-red-400">Remove</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Submissions ──────────────────────────── */}
      {tab === 'submissions' && (
        <div>
          {submissions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No submissions yet.</p>
          ) : (
            <div className="space-y-2">
              {submissions.map(sub => (
                <div key={sub.id} className="bg-card border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-foreground text-sm font-medium">{sub.employees?.name ?? sub.employee_id}</span>
                    <span className="text-muted-foreground text-xs">Seniority #{sub.employees?.seniority_number ?? '—'}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {(sub.preferences as any[]).sort((a,b) => a.rank-b.rank).map(p => (
                      <span key={p.slot_id}>#{p.rank}: {slots.find(s => s.id === p.slot_id)?.bid_number ?? '?'}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Awards ──────────────────────────────── */}
      {tab === 'awards' && (
        <div>
          {awards.length === 0 ? (
            <p className="text-muted-foreground text-sm">No awards yet. Lock cycle and run award engine.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs">
                    <th className="text-left py-2 pr-4">Employee</th>
                    <th className="text-left py-2 pr-4">Bid Slot</th>
                    <th className="text-left py-2 pr-4">Pref Rank</th>
                    <th className="text-left py-2 pr-4">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {awards.map(aw => (
                    <tr key={aw.id} className="border-b border-border/50">
                      <td className="py-2 pr-4 text-foreground">{(aw as any).employees?.name ?? aw.employee_id}</td>
                      <td className="py-2 pr-4 text-foreground">Bid #{(aw as any).shift_bid_slots?.bid_number ?? '?'}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{aw.preference_rank ?? '—'}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{aw.award_method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
