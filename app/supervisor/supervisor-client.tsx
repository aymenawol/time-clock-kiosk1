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
  employee: { id: string; name: string; seniority_number: number | null } | null
  bus: { id: string; bus_number: string; bus_type: string; fuel_level: number | null; status: string } | null
  tablet: { id: string; tablet_number: string } | null
  breaks: Break[]
}
interface Bus { id: string; bus_number: string; bus_type: string; status: string; fuel_level: number | null }
interface Defect { id: string; bus_id: string; defect_category: string | null; defect_item: string | null; notes: string; created_at: string; buses: { bus_number: string } | null }

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

const BUS_STATUS_COLOR: Record<string, string> = {
  ready:              'text-green-400',
  in_service:         'text-blue-400',
  charging:           'text-yellow-400',
  fuel:               'text-yellow-400',
  wash:               'text-cyan-400',
  shopped_dvir:       'text-red-400',
  maintenance_repair: 'text-red-400',
  maintenance_pmi:    'text-orange-400',
  safety_hold:        'text-purple-400',
}

export default function SupervisorClient({
  initialShifts, fleet, openDefects, today,
}: {
  initialShifts: Shift[]
  fleet: Bus[]
  openDefects: Defect[]
  today: string
}) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const ch = supabase.channel('supervisor-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'breaks' }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buses' }, () => router.refresh())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [router])

  const active    = initialShifts.filter(s => s.status === 'active')
  const scheduled = initialShifts.filter(s => s.status === 'scheduled')
  const completed = initialShifts.filter(s => s.status === 'completed')

  const breakAlerts = initialShifts.flatMap(s =>
    s.breaks.filter(b => ['active', 'overrun', 'missed'].includes(b.status))
      .map(b => ({ ...b, driver: s.employee, bus: s.bus }))
  )

  const inService    = fleet.filter(b => b.status === 'in_service')
  const shopBuses    = fleet.filter(b => ['shopped_dvir', 'maintenance_repair', 'maintenance_pmi', 'safety_hold'].includes(b.status))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Supervisor Dashboard</h1>
        <p className="text-gray-500 text-sm">{today} · Live</p>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3 flex-wrap">
        <Pill label="Active Drivers" value={active.length} color="bg-blue-950 text-blue-300 border-blue-800" />
        <Pill label="Scheduled"      value={scheduled.length} color="bg-gray-800 text-gray-300 border-gray-700" />
        <Pill label="Completed"      value={completed.length} color="bg-green-950 text-green-300 border-green-800" />
        <Pill label="Buses In-Svc"   value={inService.length} color="bg-blue-950 text-blue-300 border-blue-800" />
        <Pill label="Shop / Hold"    value={shopBuses.length} color="bg-red-950 text-red-300 border-red-800" />
        <Pill label="Open Defects"   value={openDefects.length} color="bg-orange-950 text-orange-300 border-orange-800" />
      </div>

      {/* Break alerts */}
      {breakAlerts.length > 0 && (
        <div className="bg-yellow-950/50 border border-yellow-700 rounded-xl p-4">
          <h2 className="text-yellow-300 font-semibold text-sm mb-3 uppercase tracking-wide">Break Alerts</h2>
          <div className="space-y-2">
            {breakAlerts.map(b => (
              <div key={b.id} className="flex items-center gap-3 text-sm">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${BREAK_STATUS_COLOR[b.status] ?? 'bg-gray-700 text-gray-400'}`}>
                  {b.status}
                </span>
                <span className="text-white">{b.driver?.name}</span>
                {b.bus && <span className="text-gray-500 text-xs">Bus #{b.bus.bus_number}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open Defects */}
      {openDefects.length > 0 && (
        <div className="bg-orange-950/30 border border-orange-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-orange-950/40 flex items-center justify-between">
            <h2 className="text-orange-300 font-semibold text-sm">Open Defects</h2>
            <span className="text-orange-400 text-xs">{openDefects.length}</span>
          </div>
          <div className="divide-y divide-orange-900/40 max-h-48 overflow-y-auto">
            {openDefects.map(d => (
              <div key={d.id} className="px-4 py-2.5 text-sm">
                <span className="text-white">Bus #{d.buses?.bus_number ?? '?'}</span>
                <span className="text-gray-400 ml-2">{d.defect_category} – {d.defect_item ?? d.notes}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active drivers table */}
      <div>
        <h2 className="text-gray-300 font-semibold text-sm mb-3">Active Drivers ({active.length})</h2>
        {active.length === 0 ? (
          <p className="text-gray-600 text-sm">No active drivers.</p>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="divide-y divide-gray-800">
              {active.map(s => (
                <ShiftRow key={s.id} shift={s} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Scheduled drivers */}
      {scheduled.length > 0 && (
        <div>
          <h2 className="text-gray-500 font-semibold text-sm mb-3">Scheduled ({scheduled.length})</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="divide-y divide-gray-800">
              {scheduled.map(s => (
                <ShiftRow key={s.id} shift={s} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Fleet with problems */}
      {shopBuses.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-800/60">
            <h2 className="text-white font-semibold text-sm">Buses Out of Service / Shop</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {shopBuses.map(b => (
              <div key={b.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                <span className="text-white">Bus #{b.bus_number}</span>
                <span className={`text-xs ${BUS_STATUS_COLOR[b.status] ?? 'text-gray-400'}`}>{b.status.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ShiftRow({ shift }: { shift: Shift }) {
  const RADIO_COLOR: Record<string, string> = {
    '10-8':  'bg-green-900 text-green-300',
    '10-39': 'bg-yellow-900 text-yellow-300',
    '10-37': 'bg-blue-900 text-blue-300',
    '10-7':  'bg-red-900 text-red-300',
  }
  const activeBreak = shift.breaks.find(b => b.status === 'active')
  return (
    <div className="px-4 py-3 flex items-center gap-3 text-sm">
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">
          {shift.employee?.name}
        </p>
        <p className="text-gray-500 text-xs">
          {shift.scheduled_start ?? '—'} – {shift.scheduled_end ?? '—'}
          {shift.bus && <span className="ml-2">Bus #{shift.bus.bus_number}</span>}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {activeBreak && (
          <span className="bg-yellow-800 text-yellow-200 text-xs px-1.5 py-0.5 rounded">Break</span>
        )}
        {shift.radio_status && (
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${RADIO_COLOR[shift.radio_status] ?? 'bg-gray-700 text-gray-400'}`}>
            {shift.radio_status}
          </span>
        )}
      </div>
    </div>
  )
}

function Pill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`border rounded-lg px-3 py-2 text-center min-w-[80px] ${color}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] uppercase tracking-wide opacity-70">{label}</p>
    </div>
  )
}
