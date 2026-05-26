'use client'

import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { isPositionStale, minutesSinceLastPosition } from '@/lib/gps-utils'
import { calcETA, type PositionSample } from '@/lib/gps-utils'
import { TERMINALS } from '@/lib/terminals'

// ─────────────────────────────── Types ───────────────────────────────

interface Bus {
  id: string; bus_number: string; bus_type: 'EV' | 'Diesel'
  fuel_level: number | null; battery_level: number | null; status: string
}

interface Employee { id: string; first_name: string; last_name: string }

interface BusPosition {
  bus_id: string; latitude: number; longitude: number
  speed: number | null; heading: number | null; recorded_at: string
}

interface Shift {
  id: string; bus_id: string | null; employee_id: string | null
  status: string; radio_status: string | null
  actual_start: string | null; scheduled_end: string | null
  bus: Bus | null; employee: Employee | null
}

interface FatigueAlert {
  id: string; employee_id: string; alert_type: string
  triggered_at: string; resolved_at: string | null; dismissed_at: string | null
  employees: { first_name: string; last_name: string } | null
}

interface OtBanner { is_active: boolean; message: string | null }

interface Props {
  activeShifts: Shift[]
  buses: Bus[]
  latestPositions: Record<string, BusPosition>
  fatigueAlerts: FatigueAlert[]
  otBanner: OtBanner | null
  availableBusCount: number
  oosBusCount: number
}

// ─────────────────────────────── Constants ───────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  'available':     'border-green-700 bg-green-950/20',
  'in_service':    'border-blue-700 bg-blue-950/20',
  'charging':      'border-teal-700 bg-teal-950/20',
  'fueling':       'border-orange-700 bg-orange-950/20',
  'washing':       'border-cyan-700 bg-cyan-950/20',
  'maintenance':   'border-yellow-700 bg-yellow-950/20',
  'safety_hold':   'border-red-800 bg-red-950/20',
  'out_of_service':'border-gray-700 bg-gray-900/40',
}

const STATUS_LABEL: Record<string, string> = {
  'available':      'Available',
  'in_service':     'In Service',
  'charging':       'Charging',
  'fueling':        'Fueling',
  'washing':        'Washing',
  'maintenance':    'Maintenance',
  'safety_hold':    'Safety Hold',
  'out_of_service': 'OOS',
}

const RADIO_LABELS: Record<string, string> = {
  '10-8': 'In Service', '10-39': 'On Break', '10-37': 'Fueling/Wash',
  '10-7': 'OOS', '10-51': 'Assist Needed', '10-33': 'HAZARD',
}

function MilitaryClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [])
  return <span className="font-mono tabular-nums">{time}</span>
}

// ─────────────────────────────── Main Component ───────────────────────────────

export default function DispatchBoardClient({
  activeShifts: initialShifts,
  buses: initialBuses,
  latestPositions: initialPositions,
  fatigueAlerts: initialAlerts,
  otBanner: initialBanner,
  availableBusCount,
  oosBusCount,
}: Props) {
  const [shifts, setShifts] = useState<Shift[]>(initialShifts)
  const [buses, setBuses] = useState<Bus[]>(initialBuses)
  const [positions, setPositions] = useState<Record<string, BusPosition>>(initialPositions)
  const [alerts, setAlerts] = useState<FatigueAlert[]>(initialAlerts)
  const [banner, setBanner] = useState<OtBanner | null>(initialBanner)
  const posHistoryRef = useRef<Record<string, BusPosition[]>>({})
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null)

  // Seed history
  useEffect(() => {
    Object.entries(initialPositions).forEach(([busId, pos]) => {
      posHistoryRef.current[busId] = [pos]
    })
  }, [initialPositions])

  // Realtime subscriptions
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const channel = supabase
      .channel('dispatch-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, payload => {
        if (payload.eventType === 'UPDATE') {
          setShifts(prev => prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } : s))
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bus_positions' }, payload => {
        const pos = payload.new as BusPosition
        const hist = posHistoryRef.current[pos.bus_id] ?? []
        posHistoryRef.current[pos.bus_id] = [pos, ...hist].slice(0, 5)
        setPositions(prev => ({ ...prev, [pos.bus_id]: pos }))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fatigue_alerts' }, payload => {
        setAlerts(prev => [payload.new as FatigueAlert, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fatigue_alerts' }, payload => {
        setAlerts(prev => prev.map(a => a.id === payload.new.id ? { ...a, ...payload.new } : a))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ot_banner' }, payload => {
        setBanner(payload.new as OtBanner)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'buses' }, payload => {
        setBuses(prev => prev.map(b => b.id === payload.new.id ? { ...b, ...payload.new } : b))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const activeDriverCount = shifts.filter(s => s.status === 'active').length
  const unresolvedAlerts  = alerts.filter(a => !a.resolved_at && !a.dismissed_at)
  const selectedShift     = selectedBusId ? shifts.find(s => s.bus_id === selectedBusId) : null
  const selectedBus       = selectedBusId ? buses.find(b => b.id === selectedBusId) : null
  const selectedPosition  = selectedBusId ? positions[selectedBusId] : null

  return (
    <div className="flex flex-col h-screen select-none">
      {/* ── Top Bar ── */}
      <header className="flex items-center gap-4 bg-gray-900 border-b border-gray-800 px-4 h-10 shrink-0">
        <div className="text-lg font-bold text-white tracking-widest uppercase">
          <MilitaryClock />
        </div>
        <span className="text-gray-500 text-sm">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
        </span>

        <div className="ml-auto flex items-center gap-5 text-sm">
          <span className="text-gray-400">Drivers Active: <span className="text-white font-bold">{activeDriverCount}</span></span>
          <span className="text-gray-400">Available Buses: <span className="text-green-400 font-bold">{availableBusCount}</span></span>
          <span className="text-gray-400">OOS: <span className="text-red-400 font-bold">{oosBusCount}</span></span>
          {unresolvedAlerts.length > 0 && (
            <span className="text-red-400 font-bold animate-pulse">
              ⚠ {unresolvedAlerts.length} Fatigue Alert{unresolvedAlerts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <a href="/admin/map" className="ml-4 text-xs text-gray-500 hover:text-gray-300 border border-gray-700 px-2 py-1 rounded">
          GPS Map →
        </a>
        <a href="/dispatcher" className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 px-2 py-1 rounded">
          Dispatcher ←
        </a>
      </header>

      {/* ── OT Banner ── */}
      {banner?.is_active && banner.message && (
        <div className="bg-yellow-900/30 border-b border-yellow-700 px-4 py-1.5 text-yellow-200 text-sm">
          📢 {banner.message}
        </div>
      )}

      {/* ── Main Area ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Bus Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {buses.map(bus => {
              const shift  = shifts.find(s => s.bus_id === bus.id && s.status === 'active')
              const pos    = positions[bus.id]
              const stale  = pos ? isPositionStale(pos.recorded_at) : false
              const colorCls = STATUS_COLORS[bus.status] ?? 'border-gray-700 bg-gray-900'
              const isSelected = selectedBusId === bus.id

              return (
                <button
                  key={bus.id}
                  onClick={() => setSelectedBusId(isSelected ? null : bus.id)}
                  className={`rounded-xl border p-2.5 text-left transition-all ${colorCls} ${
                    isSelected ? 'ring-2 ring-white' : 'hover:ring-1 hover:ring-gray-500'
                  }`}
                >
                  {/* Bus number + type */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-white text-base">#{bus.bus_number}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                      bus.bus_type === 'EV' ? 'bg-teal-900 text-teal-300' : 'bg-gray-800 text-gray-400'
                    }`}>{bus.bus_type}</span>
                  </div>

                  {/* Status */}
                  <p className="text-xs text-gray-400 truncate">{STATUS_LABEL[bus.status] ?? bus.status}</p>

                  {/* Driver */}
                  {shift?.employee ? (
                    <p className="text-xs text-gray-300 truncate mt-0.5">
                      {shift.employee.first_name} {shift.employee.last_name[0]}.
                    </p>
                  ) : (
                    <p className="text-xs text-gray-600 mt-0.5">No driver</p>
                  )}

                  {/* Radio code */}
                  {shift?.radio_status && (
                    <p className="text-xs text-blue-400 truncate">{shift.radio_status} — {RADIO_LABELS[shift.radio_status] ?? ''}</p>
                  )}

                  {/* Fuel/Battery */}
                  {(bus.fuel_level != null || bus.battery_level != null) && (
                    <div className="mt-1.5">
                      <div className="h-1 rounded bg-gray-800 overflow-hidden">
                        <div
                          className={`h-full rounded ${
                            (bus.fuel_level ?? bus.battery_level ?? 0) < 25 ? 'bg-red-500' :
                            (bus.fuel_level ?? bus.battery_level ?? 0) < 50 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${bus.fuel_level ?? bus.battery_level ?? 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {bus.bus_type === 'EV' ? 'Charge' : 'Fuel'}: {(bus.fuel_level ?? bus.battery_level)?.toFixed(0)}%
                      </p>
                    </div>
                  )}

                  {/* GPS indicator */}
                  {pos && (
                    <p className={`text-xs mt-1 ${stale ? 'text-red-500' : 'text-green-500'}`}>
                      {stale ? `GPS⚠ ${minutesSinceLastPosition(pos.recorded_at)}m` : '● GPS'}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Right sidebar: selected bus detail + alerts */}
        <div className="w-72 bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden shrink-0">
          {/* Selected bus detail */}
          {selectedBus && (
            <div className="p-3 border-b border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white">Bus #{selectedBus.bus_number}</span>
                <button onClick={() => setSelectedBusId(null)} className="text-gray-600 hover:text-white text-xs">✕</button>
              </div>

              {selectedShift?.employee && (
                <p className="text-gray-300 text-sm">
                  {selectedShift.employee.first_name} {selectedShift.employee.last_name}
                </p>
              )}

              {selectedPosition && (
                <>
                  <p className="text-xs text-gray-500 mt-2">
                    Speed: {selectedPosition.speed != null ? `${selectedPosition.speed.toFixed(0)} km/h` : '—'} &nbsp;
                    Heading: {selectedPosition.heading != null ? `${selectedPosition.heading.toFixed(0)}°` : '—'}
                  </p>

                  <div className="mt-2 space-y-0.5">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">ETAs</p>
                    {TERMINALS.map(t => {
                      const history = posHistoryRef.current[selectedBus.id] ?? []
                      const samples: PositionSample[] = history.map(p => ({
                        lat: p.latitude, lng: p.longitude, recorded_at: p.recorded_at, speed: p.speed,
                      }))
                      const eta = calcETA(samples, t)
                      return (
                        <p key={t.id} className="text-xs text-gray-300">
                          {t.name}: {eta != null ? `~${eta} min` : '—'}
                        </p>
                      )
                    })}
                  </div>

                  <p className="text-xs text-gray-600 mt-1">
                    {isPositionStale(selectedPosition.recorded_at)
                      ? `⚠ GPS lost ${minutesSinceLastPosition(selectedPosition.recorded_at)}m ago`
                      : `Live · ${minutesSinceLastPosition(selectedPosition.recorded_at)}m ago`}
                  </p>
                </>
              )}

              {selectedShift && (
                <a
                  href="/admin/map"
                  className="mt-2 block text-xs text-blue-400 hover:text-blue-300"
                >
                  View on map →
                </a>
              )}
            </div>
          )}

          {/* Fatigue / alert feed */}
          <div className="flex-1 overflow-y-auto p-3">
            <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-2">
              Active Alerts ({unresolvedAlerts.length})
            </p>
            {unresolvedAlerts.length === 0 && (
              <p className="text-gray-600 text-sm">No active alerts.</p>
            )}
            {unresolvedAlerts.map(a => (
              <div key={a.id} className="rounded-lg border border-red-800 bg-red-950/20 p-2.5 mb-2">
                <p className="text-red-300 text-xs font-semibold capitalize">
                  {a.alert_type.replace(/_/g, ' ')}
                </p>
                {a.employees && (
                  <p className="text-gray-300 text-xs">{a.employees.first_name} {a.employees.last_name}</p>
                )}
                <p className="text-gray-600 text-xs">{new Date(a.triggered_at).toLocaleTimeString()}</p>
                <a href="/admin/fatigue" className="text-red-400 text-xs hover:text-red-300">Review →</a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
