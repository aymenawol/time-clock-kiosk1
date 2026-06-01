'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

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
  pending:   'text-gray-500',
  active:    'text-yellow-400 animate-pulse',
  completed: 'text-green-400',
  missed:    'text-red-500',
  overrun:   'text-orange-400 animate-pulse',
}

const RADIO_CODES = [
  { code: '10-8', label: 'In Service',     color: 'bg-green-700 hover:bg-green-600' },
  { code: '10-39', label: 'Break',         color: 'bg-yellow-700 hover:bg-yellow-600' },
  { code: '10-37', label: 'Fueling',       color: 'bg-blue-700 hover:bg-blue-600' },
  { code: '10-7',  label: 'Out of Service',color: 'bg-red-700 hover:bg-red-600' },
]

function formatTime(ts: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function BreakBadge({ brk }: { brk: BreakRow | undefined; }) {
  if (!brk) return <span className="text-gray-700 text-xs">—</span>
  const color = BREAK_STATUS_COLOR[brk.status] ?? 'text-gray-400'
  const label = brk.status === 'active'
    ? `${brk.break_number === 1 ? 'B1' : 'B2'} ⏱`
    : brk.status === 'completed'
    ? `${brk.break_number === 1 ? 'B1' : 'B2'} ✓`
    : brk.status === 'missed'
    ? `${brk.break_number === 1 ? 'B1' : 'B2'} ✗`
    : `${brk.break_number === 1 ? 'B1' : 'B2'} …`
  return <span className={`text-xs font-mono ${color}`}>{label}</span>
}

export default function DispatcherClient({ initialShifts, initialBuses, availableTablets, today }: Props) {
  const router = useRouter()
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => {
        // Re-fetch on any change (simplest and correct approach)
        router.refresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'breaks' }, () => {
        router.refresh()
      })
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
  }, [router])

  const activeShifts    = shifts.filter(s => s.status === 'active')
  const scheduledShifts = shifts.filter(s => s.status === 'scheduled')
  const readyBuses      = buses.filter(b => b.status === 'ready').length
  const inServiceBuses  = buses.filter(b => b.status === 'in_service').length

  // Break alerts: active, overrun, or missed today
  const breakAlerts = shifts.flatMap(s =>
    s.breaks.filter(b => ['active', 'overrun', 'missed'].includes(b.status))
      .map(b => ({ shift: s, brk: b }))
  )

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Dispatch Dashboard</h1>
          <p className="text-sm text-gray-500">
            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} &nbsp;·&nbsp;
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/dispatcher/sign-in')}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            + Sign In Driver
          </button>
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3 flex-wrap text-sm">
        <Pill label="Active"    value={activeShifts.length}    color="blue" />
        <Pill label="Scheduled" value={scheduledShifts.length} color="gray" />
        <Pill label="Ready buses"  value={readyBuses}          color="green" />
        <Pill label="On route"  value={inServiceBuses}         color="teal" />
        {breakAlerts.length > 0 && <Pill label="Break alerts" value={breakAlerts.length} color="red" />}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Active drivers grid */}
        <div className="xl:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Active Drivers ({activeShifts.length})
          </h2>
          {activeShifts.length === 0 ? (
            <p className="text-gray-600 text-sm">No active shifts yet today.</p>
          ) : (
            <div className="overflow-auto rounded-lg border border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 text-gray-500 text-xs uppercase">
                    <th className="px-3 py-2 text-left">Driver</th>
                    <th className="px-3 py-2 text-left">Bus</th>
                    <th className="px-3 py-2 text-left">Tablet</th>
                    <th className="px-3 py-2 text-left">Start</th>
                    <th className="px-3 py-2 text-center">B1</th>
                    <th className="px-3 py-2 text-center">B2</th>
                    <th className="px-3 py-2 text-left">Radio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {activeShifts.map(s => {
                    const b1 = s.breaks.find(b => b.break_number === 1)
                    const b2 = s.breaks.find(b => b.break_number === 2)
                    return (
                      <tr key={s.id} className="hover:bg-gray-900/50">
                        <td className="px-3 py-2 text-white font-medium">
                          {s.employee?.name}
                          {s.employee?.seniority_number && (
                            <span className="text-gray-600 text-xs ml-1">#{s.employee.seniority_number}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {s.bus ? (
                            <span className="text-white">
                              #{s.bus.bus_number}
                              <span className="text-gray-500 text-xs ml-1">{s.bus.bus_type}</span>
                            </span>
                          ) : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-400">{s.tablet?.tablet_number ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-400">{formatTime(s.actual_start)}</td>
                        <td className="px-3 py-2 text-center"><BreakBadge brk={b1 as any} /></td>
                        <td className="px-3 py-2 text-center"><BreakBadge brk={b2 as any} /></td>
                        <td className="px-3 py-2">
                          {s.radio_status ? (
                            <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                              s.radio_status === '10-7' ? 'bg-red-900 text-red-300' :
                              s.radio_status === '10-8' ? 'bg-green-900 text-green-300' :
                              'bg-yellow-900 text-yellow-300'
                            }`}>{s.radio_status}</span>
                          ) : <span className="text-gray-700 text-xs">—</span>}
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
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">
                {scheduledShifts.length} scheduled (not yet started)
              </summary>
              <div className="mt-2 space-y-1">
                {scheduledShifts.map(s => (
                  <div key={s.id} className="flex gap-3 text-xs text-gray-500 border border-gray-800 rounded px-3 py-1.5">
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
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Break Alerts {breakAlerts.length > 0 && `(${breakAlerts.length})`}
          </h2>
          {breakAlerts.length === 0 ? (
            <p className="text-gray-700 text-sm">All clear.</p>
          ) : (
            <div className="space-y-2">
              {breakAlerts.map(({ shift: s, brk: b }) => (
                <div key={b.id} className={`border rounded-lg px-3 py-2 text-sm ${
                  b.status === 'overrun' ? 'border-orange-700 bg-orange-950/30' :
                  b.status === 'missed'  ? 'border-red-800 bg-red-950/30' :
                  'border-yellow-800 bg-yellow-950/20'
                }`}>
                  <div className="flex justify-between items-start">
                    <span className="text-white font-medium text-xs">
                      {s.employee?.name}
                    </span>
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                      b.status === 'overrun' ? 'bg-orange-900 text-orange-300' :
                      b.status === 'missed'  ? 'bg-red-900 text-red-300' :
                      'bg-yellow-900 text-yellow-300'
                    }`}>{b.status}</span>
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5">
                    Break {b.break_number} · Bus #{s.bus?.bus_number ?? '?'}
                    {b.actual_start && ` · Started ${formatTime(b.actual_start)}`}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Available buses mini-list */}
          <div className="mt-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Ready Buses ({readyBuses})
            </h2>
            <div className="grid grid-cols-4 gap-1">
              {buses.filter(b => b.status === 'ready').map(b => (
                <div key={b.id} className="bg-green-950/50 border border-green-800 rounded text-[11px] text-center py-1 text-green-300">
                  #{b.bus_number}
                </div>
              ))}
              {readyBuses === 0 && <p className="text-gray-700 text-xs col-span-4">None available.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Pill({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue:  'bg-blue-900/40 text-blue-300 border-blue-800',
    gray:  'bg-gray-800 text-gray-400 border-gray-700',
    green: 'bg-green-900/40 text-green-300 border-green-800',
    teal:  'bg-teal-900/40 text-teal-300 border-teal-800',
    red:   'bg-red-900/40 text-red-300 border-red-800 animate-pulse',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs font-medium ${colors[color] ?? colors.gray}`}>
      <span className="text-base font-bold leading-none">{value}</span>
      {label}
    </span>
  )
}
