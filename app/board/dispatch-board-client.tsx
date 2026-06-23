'use client'

import { useEffect, useRef, useState, useMemo, useCallback, memo } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { isPositionStale, minutesSinceLastPosition } from '@/lib/gps-utils'
import { calcETA, type PositionSample } from '@/lib/gps-utils'
import { TERMINALS } from '@/lib/terminals'
import { busStatusLabel } from '@/lib/constants/bus-status'
import type { BusStatus } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Map, Radio, X, MapPin, ArrowLeft, ArrowRight, Megaphone } from 'lucide-react'

// ─────────────────────────────── Types ───────────────────────────────

interface Bus {
  id: string; bus_number: string; bus_type: 'EV' | 'Diesel'
  fuel_level: number | null; status: string
}

interface Employee { id: string; name: string }

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
  employees: { name: string } | null
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

// Bus-status labels come from the canonical map in lib/constants/bus-status.
// Tile colors map each status to a tokenized operational ramp (DESIGN.md §4)
// so the wall display reads correctly in both light and dark.
const BUS_STATUS_RAMP: Record<BusStatus, string> = {
  ready:              'bg-ok-surface text-ok border-ok-border',
  in_service:         'bg-info-surface text-info border-info-border',
  charging:           'bg-info-surface text-info border-info-border',
  fuel:               'bg-warn-surface text-warn border-warn-border',
  wash:               'bg-warn-surface text-warn border-warn-border',
  fuel_wash:          'bg-warn-surface text-warn border-warn-border',
  maintenance_pmi:    'bg-danger-surface text-danger border-danger-border',
  shopped_dvir:       'bg-danger-surface text-danger border-danger-border',
  maintenance_repair: 'bg-danger-surface text-danger border-danger-border',
  safety_hold:        'bg-hazard-surface text-hazard border-hazard-border',
  salvage:            'bg-neutral-surface text-neutral border-neutral-border',
  training:           'bg-info-surface text-info border-info-border',
}

function busStatusRamp(status: string): string {
  return (BUS_STATUS_RAMP as Record<string, string>)[status]
    ?? 'bg-neutral-surface text-neutral border-neutral-border'
}

const RADIO_LABELS: Record<string, string> = {
  '10-8': 'In Service', '10-39': 'On Break', '10-37': 'Fueling/Wash',
  '10-7': 'OOS', '10-51': 'Assist Needed', '10-33': 'HAZARD',
}

// One bus tile, memoized so a realtime tick only re-renders the tiles whose
// own bus/shift/position/selection actually changed — not all 50+ at once.
const BusTile = memo(function BusTile({
  bus,
  shift,
  pos,
  isSelected,
  onSelect,
}: {
  bus: Bus
  shift: Shift | undefined
  pos: BusPosition | undefined
  isSelected: boolean
  onSelect: (busId: string) => void
}) {
  const stale = pos ? isPositionStale(pos.recorded_at) : false
  const colorCls = busStatusRamp(bus.status)

  return (
    <button
      onClick={() => onSelect(bus.id)}
      className={`rounded-xl border p-2.5 text-left transition-all min-w-0 ${colorCls} ${
        isSelected ? 'ring-2 ring-ring' : 'hover:ring-1 hover:ring-border'
      }`}
    >
      {/* Bus number + type */}
      <div className="flex items-center justify-between gap-1 mb-1 min-w-0">
        <span className="font-bold text-foreground text-base truncate">#{bus.bus_number}</span>
        {bus.bus_type === 'EV' ? (
          <Badge variant="info" className="shrink-0">EV</Badge>
        ) : (
          <Badge variant="secondary" className="shrink-0">{bus.bus_type}</Badge>
        )}
      </div>

      {/* Status */}
      <p className="text-xs truncate">{busStatusLabel(bus.status)}</p>

      {/* Driver */}
      {shift?.employee ? (
        <p className="text-xs text-foreground truncate mt-0.5">
          {shift.employee.name}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground mt-0.5">No driver</p>
      )}

      {/* Radio code */}
      {shift?.radio_status && (
        <p className="text-xs text-info truncate flex items-center gap-1">
          <Radio className="size-3 shrink-0" aria-hidden />
          {shift.radio_status} — {RADIO_LABELS[shift.radio_status] ?? ''}
        </p>
      )}

      {/* Fuel/Battery */}
      {bus.fuel_level != null && (
        <div className="mt-1.5">
          <div className="h-1 rounded bg-muted overflow-hidden">
            <div
              className={`h-full rounded ${
                (bus.fuel_level ?? 0) < 25 ? 'bg-danger' :
                (bus.fuel_level ?? 0) < 50 ? 'bg-warn' : 'bg-ok'
              }`}
              style={{ width: `${bus.fuel_level ?? 0}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {bus.bus_type === 'EV' ? 'Charge' : 'Fuel'}: {bus.fuel_level?.toFixed(0)}%
          </p>
        </div>
      )}

      {/* GPS indicator */}
      {pos && (
        <p className={`text-xs mt-1 flex items-center gap-1 ${stale ? 'text-danger' : 'text-ok'}`}>
          <MapPin className="size-3 shrink-0" aria-hidden />
          {stale ? `GPS ${minutesSinceLastPosition(pos.recorded_at)}m` : 'GPS'}
        </p>
      )}
    </button>
  )
})

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

  // Index active shifts by bus once per shifts change, so the tile grid is O(buses)
  // instead of O(buses × shifts) (was a shifts.find() per tile on every render).
  const activeShiftByBus = useMemo(() => {
    const m: Record<string, Shift> = {}
    for (const s of shifts) {
      if (s.status === 'active' && s.bus_id) m[s.bus_id] = s
    }
    return m
  }, [shifts])

  // Stable identity so memoized tiles don't re-render just because the parent did.
  const handleSelect = useCallback(
    (busId: string) => setSelectedBusId(prev => (prev === busId ? null : busId)),
    []
  )

  return (
    <div className="flex flex-col h-screen select-none bg-background text-foreground">
      {/* ── Top Bar ── */}
      <header className="flex items-center gap-3 sm:gap-4 bg-card border-b border-border px-3 sm:px-4 h-10 shrink-0 min-w-0">
        <div className="text-lg font-bold text-foreground tracking-widest uppercase shrink-0">
          <MilitaryClock />
        </div>
        <span className="text-muted-foreground text-sm hidden md:inline truncate">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
        </span>

        <div className="ml-auto flex items-center gap-3 sm:gap-5 text-sm min-w-0">
          <span className="text-muted-foreground whitespace-nowrap hidden sm:inline">Drivers Active: <span className="text-foreground font-bold">{activeDriverCount}</span></span>
          <span className="text-muted-foreground whitespace-nowrap">Available: <span className="text-ok font-bold">{availableBusCount}</span></span>
          <span className="text-muted-foreground whitespace-nowrap">OOS: <span className="text-danger font-bold">{oosBusCount}</span></span>
          {unresolvedAlerts.length > 0 && (
            <span className="text-danger font-bold animate-pulse flex items-center gap-1 whitespace-nowrap">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              {unresolvedAlerts.length} Fatigue Alert{unresolvedAlerts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <Link href="/admin/map" className="ml-2 sm:ml-4 text-xs text-muted-foreground hover:text-foreground border border-border px-2 py-1 rounded flex items-center gap-1 whitespace-nowrap shrink-0">
          <Map className="size-3.5 shrink-0" aria-hidden />
          <span className="hidden sm:inline">GPS Map</span>
          <ArrowRight className="size-3 shrink-0" aria-hidden />
        </Link>
        <Link href="/dispatcher" className="text-xs text-muted-foreground hover:text-foreground border border-border px-2 py-1 rounded flex items-center gap-1 whitespace-nowrap shrink-0">
          <ArrowLeft className="size-3 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Dispatcher</span>
        </Link>
      </header>

      {/* ── OT Banner ── */}
      {banner?.is_active && banner.message && (
        <div className="bg-warn-surface border-b border-warn-border px-4 py-1.5 text-warn text-sm flex items-center gap-2">
          <Megaphone className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 truncate">{banner.message}</span>
        </div>
      )}

      {/* ── Main Area ── */}
      <div className="flex flex-1 overflow-hidden min-w-0">
        {/* Bus Grid */}
        <div className="flex-1 overflow-y-auto p-3 min-w-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {buses.map(bus => (
              <BusTile
                key={bus.id}
                bus={bus}
                shift={activeShiftByBus[bus.id]}
                pos={positions[bus.id]}
                isSelected={selectedBusId === bus.id}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>

        {/* Right sidebar: selected bus detail + alerts */}
        <div className="w-64 sm:w-72 bg-card border-l border-border flex flex-col overflow-hidden shrink-0">
          {/* Selected bus detail */}
          {selectedBus && (
            <div className="p-3 border-b border-border min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
                <span className="font-bold text-foreground truncate">Bus #{selectedBus.bus_number}</span>
                <button
                  onClick={() => setSelectedBusId(null)}
                  aria-label="Close detail"
                  className="text-muted-foreground hover:text-foreground shrink-0"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>

              {selectedShift?.employee && (
                <p className="text-foreground text-sm truncate">
                  {selectedShift.employee.name}
                </p>
              )}

              {selectedPosition && (
                <>
                  <p className="text-xs text-muted-foreground mt-2">
                    Speed: {selectedPosition.speed != null ? `${selectedPosition.speed.toFixed(0)} km/h` : '—'} &nbsp;
                    Heading: {selectedPosition.heading != null ? `${selectedPosition.heading.toFixed(0)}°` : '—'}
                  </p>

                  <div className="mt-2 space-y-0.5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">ETAs</p>
                    {TERMINALS.map(t => {
                      const history = posHistoryRef.current[selectedBus.id] ?? []
                      const samples: PositionSample[] = history.map(p => ({
                        lat: p.latitude, lng: p.longitude, recorded_at: p.recorded_at, speed: p.speed,
                      }))
                      const eta = calcETA(samples, t)
                      return (
                        <p key={t.id} className="text-xs text-foreground truncate">
                          {t.name}: {eta != null ? `~${eta} min` : '—'}
                        </p>
                      )
                    })}
                  </div>

                  <p className={`text-xs mt-1 ${isPositionStale(selectedPosition.recorded_at) ? 'text-danger' : 'text-muted-foreground'}`}>
                    {isPositionStale(selectedPosition.recorded_at)
                      ? `GPS lost ${minutesSinceLastPosition(selectedPosition.recorded_at)}m ago`
                      : `Live · ${minutesSinceLastPosition(selectedPosition.recorded_at)}m ago`}
                  </p>
                </>
              )}

              {selectedShift && (
                <Link
                  href="/admin/map"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Map className="size-3.5 shrink-0" aria-hidden />
                  View on map
                  <ArrowRight className="size-3 shrink-0" aria-hidden />
                </Link>
              )}
            </div>
          )}

          {/* Fatigue / alert feed */}
          <div className="flex-1 overflow-y-auto p-3 min-w-0">
            <p className="text-muted-foreground text-xs uppercase tracking-wide font-semibold mb-2">
              Active Alerts ({unresolvedAlerts.length})
            </p>
            {unresolvedAlerts.length === 0 && (
              <p className="text-muted-foreground text-sm">No active alerts.</p>
            )}
            {unresolvedAlerts.map(a => (
              <div key={a.id} className="rounded-lg border border-danger-border bg-danger-surface p-2.5 mb-2 min-w-0">
                <p className="text-danger text-xs font-semibold capitalize flex items-center gap-1">
                  <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{a.alert_type.replace(/_/g, ' ')}</span>
                </p>
                {a.employees && (
                  <p className="text-foreground text-xs truncate">{a.employees.name}</p>
                )}
                <p className="text-muted-foreground text-xs">{new Date(a.triggered_at).toLocaleTimeString()}</p>
                <Link href="/admin/fatigue" className="text-danger text-xs hover:underline inline-flex items-center gap-1">
                  Review
                  <ArrowRight className="size-3 shrink-0" aria-hidden />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
