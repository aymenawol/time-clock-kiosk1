'use client'

import { Fragment, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
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

const BREAK_STATUS_COLOR: Record<string, string> = {
  pending:   'bg-gray-700 text-muted-foreground',
  active:    'bg-yellow-800 text-yellow-200',
  completed: 'bg-green-900 text-green-300',
  missed:    'bg-red-900 text-red-300',
  overrun:   'bg-orange-900 text-orange-300',
}

const RADIO_COLOR: Record<string, string> = {
  '10-8':  'bg-green-900 text-green-300',
  '10-39': 'bg-yellow-900 text-yellow-300',
  '10-37': 'bg-blue-900 text-blue-300',
  '10-7':  'bg-red-900 text-red-300',
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
      <div className="flex gap-3 flex-wrap">
        <Pill label="Active Drivers" value={active.length} color="bg-blue-950 text-blue-300 border-blue-800" />
        <Pill label="Scheduled" value={scheduled.length} color="bg-muted text-foreground border-border" />
        <Pill label="Completed" value={completed.length} color="bg-green-950 text-green-300 border-green-800" />
        <Pill label="Total" value={initialShifts.length} color="bg-muted text-foreground border-border" />
      </div>

      {/* Break alerts */}
      {alertBreaks.length > 0 && (
        <div className="bg-yellow-950/50 border border-yellow-700 rounded-xl p-4">
          <h2 className="text-yellow-300 font-semibold text-sm mb-3 uppercase tracking-wide">Break Alerts</h2>
          <div className="space-y-2">
            {alertBreaks.map(b => (
              <div key={b.id} className="flex items-center gap-3 text-sm">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${BREAK_STATUS_COLOR[b.status] ?? 'bg-gray-700 text-muted-foreground'}`}>
                  {b.status.toUpperCase()}
                </span>
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
          <div className="bg-card border border-border rounded-xl p-6 text-center text-gray-600 text-sm">No active shifts</div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
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
                            <span className="text-gray-600 text-xs ml-1">#{s.employee.seniority_number}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {s.bus ? `#${s.bus.bus_number}` : '—'}
                          {s.bus && <span className="text-gray-600 text-xs ml-1">{s.bus.bus_type}</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{s.scheduled_start ?? '—'}</td>
                        <td className="px-4 py-3 text-center">
                          {b1 ? <BreakBadge brk={b1} /> : <span className="text-gray-700 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {b2 ? <BreakBadge brk={b2} /> : <span className="text-gray-700 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {s.radio_status ? (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${RADIO_COLOR[s.radio_status] ?? 'bg-muted text-muted-foreground'}`}>
                              {s.radio_status}
                            </span>
                          ) : <span className="text-gray-700 text-xs">—</span>}
                        </td>
                        <td className="px-2 py-3 text-center">
                          <button
                            onClick={() => setOpenNotes(p => ({ ...p, [s.id]: !p[s.id] }))}
                            title={s.notes ? 'Edit notes' : 'Add notes'}
                            className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                              openNotes[s.id]
                                ? 'border-blue-500 text-blue-300 bg-blue-950'
                                : s.notes
                                  ? 'border-yellow-700 text-yellow-500 hover:text-yellow-300'
                                  : 'border-border text-gray-600 hover:text-foreground'
                            }`}
                          >{s.notes ? '✎' : '+'}</button>
                        </td>
                      </tr>
                      {openNotes[s.id] && (
                        <tr className="bg-background">
                          <td colSpan={7} className="px-4 pb-3 pt-1">
                            <div className="flex gap-2 items-start">
                              <textarea
                                value={noteDrafts[s.id] ?? ''}
                                onChange={e => setNoteDrafts(p => ({ ...p, [s.id]: e.target.value }))}
                                placeholder="Coordinator notes for this shift…"
                                rows={2}
                                className="flex-1 bg-card border border-border text-foreground text-xs rounded px-2 py-1.5 resize-none"
                              />
                              <button
                                onClick={() => saveNote(s.id)}
                                disabled={isPending}
                                className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-foreground px-3 py-1.5 rounded whitespace-nowrap"
                              >{isPending ? 'Saving…' : 'Save'}</button>
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
        )}
      </div>

      {/* Scheduled shifts */}
      {scheduled.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Scheduled</h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
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
        </div>
      )}

      {/* Completed shifts — EOS Reports */}
      {completed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Completed — EOS Reports</h2>
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {completed.map(s => (
              <div key={s.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-foreground font-medium text-sm">
                      {s.employee?.name}
                      {s.employee?.seniority_number && (
                        <span className="text-gray-600 text-xs ml-1">#{s.employee.seniority_number}</span>
                      )}
                    </p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Bus {s.bus ? `#${s.bus.bus_number}` : '—'} &bull;{' '}
                      {s.actual_start ?? s.scheduled_start ?? '?'} – {s.actual_end ?? s.scheduled_end ?? '?'}
                      {s.breaks.filter(b => b.status === 'completed').length > 0 && (
                        <span className="ml-2 text-green-600">
                          {s.breaks.filter(b => b.status === 'completed').length} break(s)
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => setOpenNotes(p => ({ ...p, [s.id]: !p[s.id] }))}
                    className={`shrink-0 text-xs px-2.5 py-1 rounded border transition-colors ${
                      openNotes[s.id]
                        ? 'bg-blue-800 border-blue-600 text-blue-200'
                        : s.notes
                          ? 'bg-yellow-950 border-yellow-700 text-yellow-400 hover:text-yellow-200'
                          : 'bg-muted border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >{s.notes ? '✎ Edit Report' : '+ EOS Report'}</button>
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
                        <button
                          onClick={() => saveVerdict(s.id, 'ok')}
                          disabled={isPending}
                          className={`text-xs px-2.5 py-1 rounded border font-semibold transition-colors disabled:opacity-50 ${
                            current === 'ok'
                              ? 'bg-green-700 border-green-500 text-foreground'
                              : 'bg-muted border-border text-green-400 hover:border-green-600'
                          }`}
                        >✓ OK</button>
                        <button
                          onClick={() => saveVerdict(s.id, 'flag')}
                          disabled={isPending}
                          className={`text-xs px-2.5 py-1 rounded border font-semibold transition-colors disabled:opacity-50 ${
                            current === 'flag'
                              ? 'bg-red-700 border-red-500 text-foreground'
                              : 'bg-muted border-border text-red-400 hover:border-red-600'
                          }`}
                        >✗ Flag</button>
                        {!current && (
                          <span className="text-gray-600 text-xs">
                            (suggested: {suggested === 'ok' ? '✓ OK' : '✗ Flag'})
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
                    <textarea
                      value={noteDrafts[s.id] ?? ''}
                      onChange={e => setNoteDrafts(p => ({ ...p, [s.id]: e.target.value }))}
                      placeholder="End-of-shift notes, incidents, or observations…"
                      rows={3}
                      className="w-full bg-background border border-border text-foreground text-sm rounded-lg px-3 py-2 resize-none"
                    />
                    <button
                      onClick={() => saveNote(s.id)}
                      disabled={isPending}
                      className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-foreground px-4 py-1.5 rounded-lg font-medium"
                    >{isPending ? 'Saving…' : 'Save EOS Report'}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Pill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`border rounded-lg px-3 py-2 text-sm ${color}`}>
      <span className="font-bold text-lg leading-none block">{value}</span>
      <span className="text-xs opacity-70">{label}</span>
    </div>
  )
}

function BreakBadge({ brk }: { brk: Break }) {
  const color = BREAK_STATUS_COLOR[brk.status] ?? 'bg-gray-700 text-muted-foreground'
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${color}`}>
      {brk.status === 'completed' ? '✓' : brk.status === 'active' ? '●' : brk.status === 'missed' ? '✗' : '○'}
    </span>
  )
}
