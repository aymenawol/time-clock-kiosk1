'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { UserPlus, Timer, CheckCircle2, XCircle } from 'lucide-react'
import { reEnableBreakAction } from './actions'
import { useDebouncedRefresh } from '@/lib/use-debounced-refresh'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface BreakRow {
  id: string
  break_number: 1 | 2
  status: string
  scheduled_start: string | null
  window_open: string | null
  window_close: string | null
  actual_start: string | null
  actual_end: string | null
}

interface ShiftRow {
  id: string
  date: string
  status: string
  radio_status: string | null
  actual_start: string | null
  scheduled_start: string | null
  scheduled_end: string | null
  employee: { id: string; name: string; seniority_number: number | null } | null
  bus: { id: string; bus_number: string; bus_type: string; fuel_level: number | null } | null
  tablet: { id: string; tablet_number: string } | null
  breaks: BreakRow[]
}

interface BusRow {
  id: string
  bus_number: string
  bus_type: string
  status: string
  fuel_level: number | null
}

interface Props {
  initialShifts: ShiftRow[]
  initialBuses: BusRow[]
  availableTablets: { id: string; tablet_number: string }[]
  today: string
}

const BREAK_STATUS_COLOR: Record<string, string> = {
  pending:   'text-muted-foreground',
  active:    'text-warn animate-pulse',
  completed: 'text-ok',
  missed:    'text-danger',
  overrun:   'text-danger animate-pulse',
}

const RADIO_CODES = [
  { code: '10-8', label: 'In Service',     color: 'bg-ok hover:bg-ok/90' },
  { code: '10-39', label: 'Break',         color: 'bg-warn hover:bg-warn/90' },
  { code: '10-37', label: 'Fueling',       color: 'bg-info hover:bg-info/90' },
  { code: '10-7',  label: 'Out of Service',color: 'bg-danger hover:bg-danger/90' },
]

function formatTime(ts: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function BreakBadge({ brk }: { brk: BreakRow | undefined; }) {
  if (!brk) return <span className="text-muted-foreground text-xs">—</span>
  const color = BREAK_STATUS_COLOR[brk.status] ?? 'text-muted-foreground'
  const prefix = brk.break_number === 1 ? 'B1' : 'B2'
  const Icon = brk.status === 'active'
    ? Timer
    : brk.status === 'completed'
    ? CheckCircle2
    : brk.status === 'missed'
    ? XCircle
    : null
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-mono ${color}`}>
      {prefix}
      {Icon ? <Icon className="size-3.5" aria-hidden /> : <span aria-hidden>…</span>}
    </span>
  )
}

export default function DispatcherClient({ initialShifts, initialBuses, availableTablets, today }: Props) {
  const router = useRouter()
  const debouncedRefresh = useDebouncedRefresh()
  const [, startReenable] = useTransition()
  const [shifts, setShifts] = useState<ShiftRow[]>(initialShifts)
  const [buses,  setBuses]  = useState<BusRow[]>(initialBuses)
  const [now, setNow]       = useState(new Date())

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Real-time subscriptions
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const shiftsChannel = supabase
      .channel('dispatcher-shifts')
      // Scope shifts to today + debounce so a burst of break/shift changes
      // collapses into one refetch instead of a per-event storm.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts', filter: `date=eq.${today}` }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'breaks' }, debouncedRefresh)
      .subscribe()

    const busChannel = supabase
      .channel('dispatcher-buses')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'buses' }, payload => {
        setBuses(prev => prev.map(b => b.id === payload.new.id ? { ...b, ...payload.new } : b))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(shiftsChannel)
      supabase.removeChannel(busChannel)
    }
  }, [debouncedRefresh, today])

  const activeShifts    = shifts.filter(s => s.status === 'active')
  const scheduledShifts = shifts.filter(s => s.status === 'scheduled')
  const readyBuses      = buses.filter(b => b.status === 'ready').length
  const inServiceBuses  = buses.filter(b => b.status === 'in_service').length

  // Break alerts: active, overrun, or missed today
  const breakAlerts = shifts.flatMap(s =>
    s.breaks.filter(b => ['active', 'overrun', 'missed'].includes(b.status))
      .map(b => ({ shift: s, brk: b }))
  )

  function handleReEnable(breakId: string) {
    startReenable(async () => {
      await reEnableBreakAction(breakId)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground">Dispatch Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} &nbsp;·&nbsp;
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/dispatcher/sign-in">
              <UserPlus aria-hidden />
              Sign In Driver
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3 flex-wrap text-sm">
        <Pill label="Active"    value={activeShifts.length}    color="info" />
        <Pill label="Scheduled" value={scheduledShifts.length} color="neutral" />
        <Pill label="Ready buses"  value={readyBuses}          color="ok" />
        <Pill label="On route"  value={inServiceBuses}         color="info" />
        {breakAlerts.length > 0 && <Pill label="Break alerts" value={breakAlerts.length} color="danger" />}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Active drivers grid */}
        <div className="xl:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Active Drivers ({activeShifts.length})
          </h2>
          {activeShifts.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active shifts yet today.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-muted-foreground text-xs uppercase">
                    <th className="px-3 py-2 text-left">Driver</th>
                    <th className="px-3 py-2 text-left">Bus</th>
                    <th className="px-3 py-2 text-left">Tablet</th>
                    <th className="px-3 py-2 text-left">Start</th>
                    <th className="px-3 py-2 text-center">B1</th>
                    <th className="px-3 py-2 text-center">B2</th>
                    <th className="px-3 py-2 text-left">Radio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activeShifts.map(s => {
                    const b1 = s.breaks.find(b => b.break_number === 1)
                    const b2 = s.breaks.find(b => b.break_number === 2)
                    return (
                      <tr key={s.id} className="hover:bg-accent/50">
                        <td className="px-3 py-2 text-foreground font-medium whitespace-nowrap">
                          {s.employee?.name}
                          {s.employee?.seniority_number && (
                            <span className="text-muted-foreground text-xs ml-1">#{s.employee.seniority_number}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {s.bus ? (
                            <span className="text-foreground">
                              #{s.bus.bus_number}
                              <span className="text-muted-foreground text-xs ml-1">{s.bus.bus_type}</span>
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{s.tablet?.tablet_number ?? '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatTime(s.actual_start)}</td>
                        <td className="px-3 py-2 text-center"><BreakBadge brk={b1 as any} /></td>
                        <td className="px-3 py-2 text-center"><BreakBadge brk={b2 as any} /></td>
                        <td className="px-3 py-2">
                          {s.radio_status ? (
                            <Badge
                              variant={
                                s.radio_status === '10-7' ? 'danger' :
                                s.radio_status === '10-8' ? 'ok' :
                                'warn'
                              }
                              className="font-mono rounded"
                            >{s.radio_status}</Badge>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {scheduledShifts.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground hover:text-foreground">
                {scheduledShifts.length} scheduled (not yet started)
              </summary>
              <div className="mt-2 space-y-1">
                {scheduledShifts.map(s => (
                  <div key={s.id} className="flex flex-wrap gap-3 text-xs text-muted-foreground border border-border rounded px-3 py-1.5">
                    <span>{s.employee?.name}</span>
                    <span>·</span>
                    <span>{s.scheduled_start ?? '—'}</span>
                    {s.bus && <><span>·</span><span>Bus #{s.bus.bus_number}</span></>}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Right panel: break alerts */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Break Alerts {breakAlerts.length > 0 && `(${breakAlerts.length})`}
          </h2>
          {breakAlerts.length === 0 ? (
            <p className="text-muted-foreground text-sm">All clear.</p>
          ) : (
            <div className="space-y-2">
              {breakAlerts.map(({ shift: s, brk: b }) => (
                <div key={b.id} className={`border rounded-lg px-3 py-2 text-sm ${
                  b.status === 'overrun' ? 'border-danger-border bg-danger-surface' :
                  b.status === 'missed'  ? 'border-danger-border bg-danger-surface' :
                  'border-warn-border bg-warn-surface'
                }`}>
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-foreground font-medium text-xs min-w-0 truncate">
                      {s.employee?.name}
                    </span>
                    <Badge
                      variant={b.status === 'overrun' || b.status === 'missed' ? 'danger' : 'warn'}
                      className="text-[10px] font-semibold uppercase rounded px-1.5 py-0.5"
                    >{b.status}</Badge>
                  </div>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Break {b.break_number} · Bus #{s.bus?.bus_number ?? '?'}
                    {b.actual_start && ` · Started ${formatTime(b.actual_start)}`}
                  </p>
                  {(b.status === 'missed' || b.status === 'overrun') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReEnable(b.id)}
                      className="mt-1.5 h-7 px-2 text-[11px]"
                    >
                      Re-enable break
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Available buses mini-list */}
          <div className="mt-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Ready Buses ({readyBuses})
            </h2>
            <div className="grid grid-cols-4 gap-1">
              {buses.filter(b => b.status === 'ready').map(b => (
                <div key={b.id} className="bg-ok-surface border border-ok-border rounded text-[11px] text-center py-1 text-ok">
                  #{b.bus_number}
                </div>
              ))}
              {readyBuses === 0 && <p className="text-muted-foreground text-xs col-span-4">None available.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Pill({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    info:    'bg-info-surface text-info border-info-border',
    neutral: 'bg-neutral-surface text-neutral border-neutral-border',
    ok:      'bg-ok-surface text-ok border-ok-border',
    warn:    'bg-warn-surface text-warn border-warn-border',
    danger:  'bg-danger-surface text-danger border-danger-border animate-pulse',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs font-medium ${colors[color] ?? colors.neutral}`}>
      <span className="text-base font-bold leading-none">{value}</span>
      {label}
    </span>
  )
}
