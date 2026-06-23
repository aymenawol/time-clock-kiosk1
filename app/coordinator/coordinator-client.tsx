'use client'

import { Fragment, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { AlertTriangle, Check, X, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { saveShiftNotesAction, saveComplianceVerdictAction } from './actions'
import { useDebouncedRefresh } from '@/lib/use-debounced-refresh'

interface Break {
  id: string; break_number: 1 | 2; status: string
  scheduled_start: string | null; window_open: string | null; window_close: string | null
  actual_start: string | null; actual_end: string | null; duration_minutes: number
}
interface Shift {
  id: string; status: string; scheduled_start: string | null; scheduled_end: string | null
  actual_start: string | null; actual_end: string | null; radio_status: string | null; notes: string | null
  compliance_verdict: 'ok' | 'flag' | null; compliance_note: string | null
  employee: { id: string; name: string; seniority_number: number | null } | null
  bus: { id: string; bus_number: string; bus_type: string; fuel_level: number | null; status: string } | null
  tablet: { id: string; tablet_number: string } | null
  breaks: Break[]
}

// N12 — auto-suggested compliance verdict from shift data; the coordinator
// confirms or overrides it. Flag if any break was missed or the shift never
// properly closed.
function suggestedVerdict(s: Shift): 'ok' | 'flag' {
  const missed = s.breaks.some(b => b.status === 'missed' || b.status === 'overrun')
  const closed = !!s.actual_end
  return missed || !closed ? 'flag' : 'ok'
}

type BadgeVariant = 'ok' | 'warn' | 'danger' | 'hazard' | 'info' | 'neutral'

const BREAK_STATUS_VARIANT: Record<string, BadgeVariant> = {
  pending:   'neutral',
  active:    'info',
  completed: 'ok',
  missed:    'danger',
  overrun:   'danger',
}

const RADIO_VARIANT: Record<string, BadgeVariant> = {
  '10-8':  'ok',
  '10-39': 'warn',
  '10-37': 'info',
  '10-7':  'danger',
}

export default function CoordinatorClient({ initialShifts, today }: { initialShifts: Shift[]; today: string }) {
  const router = useRouter()
  const debouncedRefresh = useDebouncedRefresh()

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const ch = supabase.channel('coord-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'breaks' }, debouncedRefresh)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [debouncedRefresh])

  const [isPending, startTransition] = useTransition()
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({})
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>(
    () => Object.fromEntries(initialShifts.map(s => [s.id, s.notes ?? '']))
  )

  function saveNote(shiftId: string) {
    startTransition(async () => {
      await saveShiftNotesAction(shiftId, noteDrafts[shiftId] ?? '')
      router.refresh()
    })
  }

  function saveVerdict(shiftId: string, verdict: 'ok' | 'flag') {
    startTransition(async () => {
      await saveComplianceVerdictAction(shiftId, verdict, noteDrafts[shiftId] ?? '')
      router.refresh()
    })
  }

  const active    = initialShifts.filter(s => s.status === 'active')
  const scheduled = initialShifts.filter(s => s.status === 'scheduled')
  const completed = initialShifts.filter(s => s.status === 'completed')

  const alertBreaks = initialShifts.flatMap(s =>
    s.breaks.filter(b => b.status === 'active' || b.status === 'overrun' || b.status === 'missed')
      .map(b => ({ ...b, driver: s.employee, bus: s.bus }))
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Coordinator Overview</h1>
        <p className="text-muted-foreground text-sm">{today} — Live</p>
      </div>

      {/* Summary pills */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Pill label="Active Drivers" value={active.length} variant="info" />
        <Pill label="Scheduled" value={scheduled.length} variant="neutral" />
        <Pill label="Completed" value={completed.length} variant="ok" />
        <Pill label="Total" value={initialShifts.length} variant="neutral" />
      </div>

      {/* Break alerts */}
      {alertBreaks.length > 0 && (
        <div className="bg-warn-surface border border-warn-border rounded-xl p-4">
          <h2 className="text-warn font-semibold text-sm mb-3 uppercase tracking-wide flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Break Alerts
          </h2>
          <div className="space-y-2">
            {alertBreaks.map(b => (
              <div key={b.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant={BREAK_STATUS_VARIANT[b.status] ?? 'neutral'}>
                  {b.status.toUpperCase()}
                </Badge>
                <span className="text-foreground font-medium">
                  {b.driver?.name}
                </span>
                <span className="text-muted-foreground">— Break {b.break_number}</span>
                {b.bus && <span className="text-muted-foreground">Bus #{b.bus.bus_number}</span>}
                {b.actual_start && (
                  <span className="text-muted-foreground text-xs ml-auto">
                    Started {new Date(b.actual_start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active shifts table */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Active Drivers</h2>
        {active.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground text-sm">No active shifts</Card>
        ) : (
          <Card className="overflow-hidden">
           <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                  <th className="px-4 py-2 text-left">Driver</th>
                  <th className="px-4 py-2 text-left">Bus</th>
                  <th className="px-4 py-2 text-left">Start</th>
                  <th className="px-4 py-2 text-center">B1</th>
                  <th className="px-4 py-2 text-center">B2</th>
                  <th className="px-4 py-2 text-left">Radio</th>
                  <th className="px-2 py-2 text-center">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {active.map(s => {
                  const b1 = s.breaks.find(b => b.break_number === 1)
                  const b2 = s.breaks.find(b => b.break_number === 2)
                  return (
                    <Fragment key={s.id}>
                      <tr className="hover:bg-muted/30">
                        <td className="px-4 py-3 text-foreground font-medium">
                          {s.employee?.name}
                          {s.employee?.seniority_number && (
                            <span className="text-muted-foreground text-xs ml-1">#{s.employee.seniority_number}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {s.bus ? `#${s.bus.bus_number}` : '—'}
                          {s.bus && <span className="text-muted-foreground text-xs ml-1">{s.bus.bus_type}</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{s.scheduled_start ?? '—'}</td>
                        <td className="px-4 py-3 text-center">
                          {b1 ? <BreakBadge brk={b1} /> : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {b2 ? <BreakBadge brk={b2} /> : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {s.radio_status ? (
                            <Badge variant={RADIO_VARIANT[s.radio_status] ?? 'neutral'}>
                              {s.radio_status}
                            </Badge>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-2 py-3 text-center">
                          <Button
                            variant={openNotes[s.id] ? 'secondary' : 'ghost'}
                            size="icon-sm"
                            onClick={() => setOpenNotes(p => ({ ...p, [s.id]: !p[s.id] }))}
                            title={s.notes ? 'Edit notes' : 'Add notes'}
                            className={s.notes && !openNotes[s.id] ? 'text-warn' : undefined}
                          >{s.notes ? <Pencil /> : <Plus />}</Button>
                        </td>
                      </tr>
                      {openNotes[s.id] && (
                        <tr className="bg-muted/30">
                          <td colSpan={7} className="px-4 pb-3 pt-1">
                            <div className="flex gap-2 items-start">
                              <Textarea
                                value={noteDrafts[s.id] ?? ''}
                                onChange={e => setNoteDrafts(p => ({ ...p, [s.id]: e.target.value }))}
                                placeholder="Coordinator notes for this shift…"
                                rows={2}
                                className="flex-1 min-h-0 text-xs resize-none"
                              />
                              <Button
                                onClick={() => saveNote(s.id)}
                                disabled={isPending}
                                size="sm"
                                className="whitespace-nowrap"
                              >{isPending ? 'Saving…' : 'Save'}</Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
           </div>
          </Card>
        )}
      </div>

      {/* Scheduled shifts */}
      {scheduled.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Scheduled</h2>
          <Card className="overflow-hidden">
           <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                  <th className="px-4 py-2 text-left">Driver</th>
                  <th className="px-4 py-2 text-left">Bus</th>
                  <th className="px-4 py-2 text-left">Sched Start</th>
                  <th className="px-4 py-2 text-left">Sched End</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {scheduled.map(s => (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-foreground">{s.employee?.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.bus ? `#${s.bus.bus_number}` : '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.scheduled_start ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.scheduled_end ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
           </div>
          </Card>
        </div>
      )}

      {/* Completed shifts — EOS Reports */}
      {completed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Completed — EOS Reports</h2>
          <Card className="divide-y divide-border">
            {completed.map(s => (
              <div key={s.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-foreground font-medium text-sm">
                      {s.employee?.name}
                      {s.employee?.seniority_number && (
                        <span className="text-muted-foreground text-xs ml-1">#{s.employee.seniority_number}</span>
                      )}
                    </p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Bus {s.bus ? `#${s.bus.bus_number}` : '—'} &bull;{' '}
                      {s.actual_start ?? s.scheduled_start ?? '?'} – {s.actual_end ?? s.scheduled_end ?? '?'}
                      {s.breaks.filter(b => b.status === 'completed').length > 0 && (
                        <span className="ml-2 text-ok">
                          {s.breaks.filter(b => b.status === 'completed').length} break(s)
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    onClick={() => setOpenNotes(p => ({ ...p, [s.id]: !p[s.id] }))}
                    variant={openNotes[s.id] ? 'secondary' : 'outline'}
                    size="sm"
                    className={`shrink-0 ${s.notes && !openNotes[s.id] ? 'text-warn' : ''}`}
                  >
                    {s.notes ? <><Pencil /> Edit Report</> : <><Plus /> EOS Report</>}
                  </Button>
                </div>
                {s.notes && !openNotes[s.id] && (
                  <p className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">{s.notes}</p>
                )}

                {/* N12 — OK/X compliance verdict */}
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Compliance:</span>
                  {(() => {
                    const current = s.compliance_verdict
                    const suggested = suggestedVerdict(s)
                    return (
                      <>
                        <Button
                          onClick={() => saveVerdict(s.id, 'ok')}
                          disabled={isPending}
                          size="sm"
                          variant={current === 'ok' ? 'success' : 'outline'}
                          className={current === 'ok' ? undefined : 'text-ok'}
                        ><Check /> OK</Button>
                        <Button
                          onClick={() => saveVerdict(s.id, 'flag')}
                          disabled={isPending}
                          size="sm"
                          variant={current === 'flag' ? 'destructive' : 'outline'}
                          className={current === 'flag' ? undefined : 'text-danger'}
                        ><X /> Flag</Button>
                        {!current && (
                          <span className="text-muted-foreground text-xs flex items-center gap-1">
                            (suggested: {suggested === 'ok' ? <><Check className="h-3 w-3" /> OK</> : <><X className="h-3 w-3" /> Flag</>})
                          </span>
                        )}
                        {s.compliance_note && (
                          <span className="text-muted-foreground text-xs">— {s.compliance_note}</span>
                        )}
                      </>
                    )
                  })()}
                </div>
                {openNotes[s.id] && (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      value={noteDrafts[s.id] ?? ''}
                      onChange={e => setNoteDrafts(p => ({ ...p, [s.id]: e.target.value }))}
                      placeholder="End-of-shift notes, incidents, or observations…"
                      rows={3}
                      className="resize-none"
                    />
                    <Button
                      onClick={() => saveNote(s.id)}
                      disabled={isPending}
                      size="sm"
                    >{isPending ? 'Saving…' : 'Save EOS Report'}</Button>
                  </div>
                )}
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  )
}

const PILL_STYLE: Record<BadgeVariant, string> = {
  ok: 'bg-ok-surface text-ok border-ok-border',
  warn: 'bg-warn-surface text-warn border-warn-border',
  danger: 'bg-danger-surface text-danger border-danger-border',
  hazard: 'bg-hazard-surface text-hazard border-hazard-border',
  info: 'bg-info-surface text-info border-info-border',
  neutral: 'bg-muted text-foreground border-border',
}

function Pill({ label, value, variant }: { label: string; value: number; variant: BadgeVariant }) {
  return (
    <div className={`border rounded-lg px-3 py-2 text-sm ${PILL_STYLE[variant]}`}>
      <span className="font-bold text-lg leading-none block">{value}</span>
      <span className="text-xs opacity-70">{label}</span>
    </div>
  )
}

function BreakBadge({ brk }: { brk: Break }) {
  return (
    <Badge variant={BREAK_STATUS_VARIANT[brk.status] ?? 'neutral'} className="px-1.5">
      {brk.status === 'completed' ? '✓' : brk.status === 'active' ? '●' : brk.status === 'missed' ? '✗' : '○'}
    </Badge>
  )
}
