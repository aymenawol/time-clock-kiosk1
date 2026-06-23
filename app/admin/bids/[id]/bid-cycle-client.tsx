'use client'
import { useTransition, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
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
  BidCycleStatus,
  ROUTE_TYPE_LABELS,
  RouteType,
} from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  cycle: ShiftBidCycle
  slots: (ShiftBidSlot & { awards: ShiftBidAward[] })[]
  submissions: (ShiftBidSubmission & { employees: { name: string; seniority_number: number | null } | null })[]
  awards: (ShiftBidAward & { employees: { name: string } | null; shift_bid_slots: { bid_number: number } | null })[]
}

type Tab = 'slots' | 'submissions' | 'awards'

const STATUS_VARIANT: Record<BidCycleStatus, BadgeProps['variant']> = {
  draft:     'neutral',
  published: 'info',
  locked:    'warn',
  awarded:   'ok',
}

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

  const selectClass =
    'h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href="/admin/bids" className="mb-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Bid Cycles
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{cycle.name}</h1>
          {cycle.description && <p className="text-muted-foreground text-sm mt-0.5">{cycle.description}</p>}
          <p className="text-muted-foreground text-xs mt-1">
            Shifts: {cycle.start_date} — {cycle.end_date}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Badge variant={STATUS_VARIANT[cycle.status]}>{cycle.status}</Badge>
          <div className="flex flex-wrap gap-2">
            {cycle.status === 'draft' && (
              <Button size="sm" onClick={() => statusAction('published')} disabled={pending}>
                Publish
              </Button>
            )}
            {cycle.status === 'published' && (
              <Button size="sm" variant="secondary" onClick={() => statusAction('locked')} disabled={pending}>
                Lock Submissions
              </Button>
            )}
            {cycle.status === 'locked' && (
              <>
                <Button size="sm" variant="success" onClick={handleRunEngine} disabled={pending}>
                  Run Award Engine
                </Button>
                <Button size="sm" onClick={() => statusAction('awarded')} disabled={pending}>
                  Mark Awarded
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {err && <p className="text-danger text-sm rounded-lg border border-danger-border bg-danger-surface px-3 py-2">{err}</p>}

      {/* Tabs */}
      <div className="flex border-b border-border gap-1 overflow-x-auto">
        {(['slots','submissions','awards'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {t} {t === 'slots' ? `(${slots.length})` : t === 'submissions' ? `(${submissions.length})` : `(${awards.length})`}
          </button>
        ))}
      </div>

      {/* ── Slots ────────────────────────────────── */}
      {tab === 'slots' && (
        <div className="space-y-3">
          {cycle.status === 'draft' && (
            <Button variant="secondary" size="sm" onClick={() => setShowSlotForm(v => !v)}>
              {showSlotForm ? 'Cancel' : <><Plus className="size-4" /> Add Slot</>}
            </Button>
          )}

          {showSlotForm && (
            <Card>
              <CardHeader>
                <CardTitle>New Bid Slot</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddSlot} className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="slot-bid-number">Bid #</Label>
                      <Input id="slot-bid-number" name="bid_number" type="number" required min={1} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="slot-route-type">Route Type</Label>
                      <select id="slot-route-type" name="route_type" required className={selectClass}>
                        {(Object.entries(ROUTE_TYPE_LABELS) as [RouteType, string][]).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="slot-report-time">Report Time</Label>
                      <Input id="slot-report-time" name="report_time" type="time" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="slot-shift-start">Shift Start</Label>
                      <Input id="slot-shift-start" name="shift_start" type="time" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="slot-shift-end">Shift End</Label>
                      <Input id="slot-shift-end" name="shift_end" type="time" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="slot-max-drivers">Max Drivers</Label>
                      <Input id="slot-max-drivers" name="max_drivers" type="number" min={1} defaultValue={1} required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Days</Label>
                    <div className="flex flex-wrap gap-3">
                      {DAY_KEYS.map((d, i) => (
                        <label key={d} className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                          {DAY_LABELS[i]}
                          <input type="checkbox" name={`days_${d}`} value="true" className="accent-primary" />
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="slot-notes">Notes</Label>
                    <Input id="slot-notes" name="notes" />
                  </div>
                  <Button type="submit" size="sm" disabled={pending}>
                    {pending ? 'Adding...' : 'Add Slot'}
                  </Button>
                </form>
              </CardContent>
            </Card>
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
                    <tr key={slot.id} className="border-b border-border/50 hover:bg-accent">
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
                          <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => handleDeleteSlot(slot.id)}>
                            <Trash2 className="size-4" /> Remove
                          </Button>
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
                <div key={sub.id} className="rounded-lg border border-border bg-card p-3 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <span className="text-foreground text-sm font-medium min-w-0 truncate">{sub.employees?.name ?? sub.employee_id}</span>
                    <span className="text-muted-foreground text-xs">Seniority #{sub.employees?.seniority_number ?? '—'}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
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
