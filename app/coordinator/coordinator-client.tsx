'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface Break {
  id: string; break_number: 1 | 2; status: string
  scheduled_start: string | null; window_open: string | null; window_close: string | null
  actual_start: string | null; actual_end: string | null; duration_minutes: number
}
interface Shift {
  id: string; status: string; scheduled_start: string | null; scheduled_end: string | null
  actual_start: string | null; actual_end: string | null; radio_status: string | null; notes: string | null
  employee: { id: string; first_name: string; last_name: string; seniority_number: number | null } | null
  bus: { id: string; bus_number: string; bus_type: string; fuel_level: number | null; status: string } | null
  tablet: { id: string; tablet_number: string } | null
  breaks: Break[]
}

const BREAK_STATUS_COLOR: Record<string, string> = {
  pending:   'bg-gray-700 text-gray-400',
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

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const ch = supabase.channel('coord-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'breaks' }, () => router.refresh())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [router])

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
        <h1 className="text-2xl font-bold text-white">Coordinator Overview</h1>
        <p className="text-gray-500 text-sm">{today} — Live</p>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3 flex-wrap">
        <Pill label="Active Drivers" value={active.length} color="bg-blue-950 text-blue-300 border-blue-800" />
        <Pill label="Scheduled" value={scheduled.length} color="bg-gray-800 text-gray-300 border-gray-700" />
        <Pill label="Completed" value={completed.length} color="bg-green-950 text-green-300 border-green-800" />
        <Pill label="Total" value={initialShifts.length} color="bg-gray-800 text-white border-gray-700" />
      </div>

      {/* Break alerts */}
      {alertBreaks.length > 0 && (
        <div className="bg-yellow-950/50 border border-yellow-700 rounded-xl p-4">
          <h2 className="text-yellow-300 font-semibold text-sm mb-3 uppercase tracking-wide">Break Alerts</h2>
          <div className="space-y-2">
            {alertBreaks.map(b => (
              <div key={b.id} className="flex items-center gap-3 text-sm">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${BREAK_STATUS_COLOR[b.status] ?? 'bg-gray-700 text-gray-400'}`}>
                  {b.status.toUpperCase()}
                </span>
                <span className="text-white font-medium">
                  {b.driver?.first_name} {b.driver?.last_name}
                </span>
                <span className="text-gray-500">— Break {b.break_number}</span>
                {b.bus && <span className="text-gray-500">Bus #{b.bus.bus_number}</span>}
                {b.actual_start && (
                  <span className="text-gray-500 text-xs ml-auto">
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
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Active Drivers</h2>
        {active.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-600 text-sm">No active shifts</div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                  <th className="px-4 py-2 text-left">Driver</th>
                  <th className="px-4 py-2 text-left">Bus</th>
                  <th className="px-4 py-2 text-left">Start</th>
                  <th className="px-4 py-2 text-center">B1</th>
                  <th className="px-4 py-2 text-center">B2</th>
                  <th className="px-4 py-2 text-left">Radio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {active.map(s => {
                  const b1 = s.breaks.find(b => b.break_number === 1)
                  const b2 = s.breaks.find(b => b.break_number === 2)
                  return (
                    <tr key={s.id} className="hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-white font-medium">
                        {s.employee?.first_name} {s.employee?.last_name}
                        {s.employee?.seniority_number && (
                          <span className="text-gray-600 text-xs ml-1">#{s.employee.seniority_number}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white">
                        {s.bus ? `#${s.bus.bus_number}` : '—'}
                        {s.bus && <span className="text-gray-600 text-xs ml-1">{s.bus.bus_type}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {s.scheduled_start ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {b1 ? <BreakBadge brk={b1} /> : <span className="text-gray-700 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {b2 ? <BreakBadge brk={b2} /> : <span className="text-gray-700 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {s.radio_status ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${RADIO_COLOR[s.radio_status] ?? 'bg-gray-800 text-gray-400'}`}>
                            {s.radio_status}
                          </span>
                        ) : <span className="text-gray-700 text-xs">—</span>}
                      </td>
                    </tr>
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
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Scheduled</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                  <th className="px-4 py-2 text-left">Driver</th>
                  <th className="px-4 py-2 text-left">Bus</th>
                  <th className="px-4 py-2 text-left">Sched Start</th>
                  <th className="px-4 py-2 text-left">Sched End</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {scheduled.map(s => (
                  <tr key={s.id} className="hover:bg-gray-800/30">
                    <td className="px-4 py-3 text-white">{s.employee?.first_name} {s.employee?.last_name}</td>
                    <td className="px-4 py-3 text-gray-400">{s.bus ? `#${s.bus.bus_number}` : '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{s.scheduled_start ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{s.scheduled_end ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
  const color = BREAK_STATUS_COLOR[brk.status] ?? 'bg-gray-700 text-gray-400'
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${color}`}>
      {brk.status === 'completed' ? '✓' : brk.status === 'active' ? '●' : brk.status === 'missed' ? '✗' : '○'}
    </span>
  )
}
