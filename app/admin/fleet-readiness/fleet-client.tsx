'use client'

import { BatteryCharging, Fuel, AlertTriangle } from 'lucide-react'
import { AVAILABLE_STATUSES, OOS_STATUSES, busStatusLabel, busStatusColor } from '@/lib/constants/bus-status'
import { Card, CardContent } from '@/components/ui/card'

interface Bus {
  id: string
  bus_number: string
  bus_type: 'EV' | 'Diesel'
  fuel_level: number | null
  status: string
}

interface DvirDefect {
  id: string
  bus_id: string
  bus_number: string
  description: string
  created_at: string
  resolved_at: string | null
}

interface Props {
  buses: Bus[]
  openDefects: DvirDefect[]
}

export default function FleetClient({ buses, openDefects }: Props) {
  const total = buses.length

  // Status breakdown
  const statusGroups: Record<string, Bus[]> = {}
  for (const bus of buses) {
    const s = bus.status ?? 'unknown'
    statusGroups[s] = [...(statusGroups[s] ?? []), bus]
  }

  const available     = AVAILABLE_STATUSES.reduce((n, s) => n + (statusGroups[s]?.length ?? 0), 0)
  const inService     = (statusGroups['in_service'] ?? []).length
  const oos           = OOS_STATUSES.reduce((n, s) => n + (statusGroups[s]?.length ?? 0), 0)
  const availablePct  = total > 0 ? Math.round((available / total) * 100) : 0

  const pctColor = availablePct >= 70 ? 'text-ok' : availablePct >= 50 ? 'text-warn' : 'text-danger'
  const pctBar   = availablePct >= 70 ? 'bg-ok' : availablePct >= 50 ? 'bg-warn' : 'bg-danger'

  // Queues — EV battery % and Diesel fuel % both live in fuel_level (no separate battery column).
  const chargingQueue = buses.filter(b => b.bus_type === 'EV' && (b.fuel_level ?? 100) < 50).sort((a, b) => (a.fuel_level ?? 0) - (b.fuel_level ?? 0))
  const fuelQueue     = buses.filter(b => b.bus_type === 'Diesel' && (b.fuel_level ?? 100) < 25).sort((a, b) => (a.fuel_level ?? 0) - (b.fuel_level ?? 0))
  const maintenanceQ  = buses.filter(b => OOS_STATUSES.includes(b.status as never))

  // Defects grouped by bus
  const defectsByBus: Record<string, DvirDefect[]> = {}
  for (const d of openDefects) {
    defectsByBus[d.bus_id] = [...(defectsByBus[d.bus_id] ?? []), d]
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">Fleet Readiness</h1>
        <p className="text-muted-foreground text-sm">{total} buses total</p>
      </div>

      {/* ── Availability Overview ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className={`text-4xl font-bold ${pctColor}`}>{availablePct}%</p>
            <p className="text-muted-foreground text-sm mt-1">Fleet Available</p>
            <div className="mt-2 h-2 rounded bg-muted overflow-hidden">
              <div className={`h-full rounded ${pctBar}`}
                style={{ width: `${availablePct}%` }} />
            </div>
          </CardContent>
        </Card>
        <Card className="border-ok-border">
          <CardContent className="p-4 text-center">
            <p className="text-4xl font-bold text-ok">{available}</p>
            <p className="text-muted-foreground text-sm mt-1">Available</p>
          </CardContent>
        </Card>
        <Card className="border-info-border">
          <CardContent className="p-4 text-center">
            <p className="text-4xl font-bold text-info">{inService}</p>
            <p className="text-muted-foreground text-sm mt-1">In Service</p>
          </CardContent>
        </Card>
        <Card className="border-danger-border">
          <CardContent className="p-4 text-center">
            <p className="text-4xl font-bold text-danger">{oos}</p>
            <p className="text-muted-foreground text-sm mt-1">OOS / Hold</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Status breakdown ── */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-foreground font-semibold mb-3">Status Breakdown</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(statusGroups).map(([status, group]) => (
              <div key={status} className={`rounded-lg border p-3 ${busStatusColor(status)}`}>
                <p className="font-bold text-xl">{group.length}</p>
                <p className="text-xs opacity-80">{busStatusLabel(status)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ── Charging Queue (EV) ── */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-foreground font-semibold mb-3 flex items-center gap-2">
              <BatteryCharging className="size-5 text-info" />
              EV Charging Queue <span className="text-muted-foreground text-sm font-normal">(&lt;50% battery)</span>
            </h2>
            {chargingQueue.length === 0 ? (
              <p className="text-muted-foreground text-sm">All EVs above 50% battery.</p>
            ) : (
              <div className="space-y-2">
                {chargingQueue.map(bus => (
                  <div key={bus.id} className="flex items-center justify-between gap-2 bg-info-surface border border-info-border rounded-lg p-2.5">
                    <span className="text-foreground font-semibold">#{bus.bus_number}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 rounded bg-muted overflow-hidden">
                        <div className="h-full rounded bg-info"
                          style={{ width: `${bus.fuel_level ?? 0}%` }} />
                      </div>
                      <span className="text-info text-sm font-mono">{(bus.fuel_level ?? 0).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Fuel Queue (Diesel) ── */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-foreground font-semibold mb-3 flex items-center gap-2">
              <Fuel className="size-5 text-warn" />
              Fuel Queue <span className="text-muted-foreground text-sm font-normal">(&lt;25% fuel)</span>
            </h2>
            {fuelQueue.length === 0 ? (
              <p className="text-muted-foreground text-sm">All diesel buses above quarter tank.</p>
            ) : (
              <div className="space-y-2">
                {fuelQueue.map(bus => (
                  <div key={bus.id} className="flex items-center justify-between gap-2 bg-warn-surface border border-warn-border rounded-lg p-2.5">
                    <span className="text-foreground font-semibold">#{bus.bus_number}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 rounded bg-muted overflow-hidden">
                        <div className="h-full rounded bg-warn"
                          style={{ width: `${bus.fuel_level ?? 0}%` }} />
                      </div>
                      <span className="text-warn text-sm font-mono">{(bus.fuel_level ?? 0).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Open DVIR Defects ── */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-foreground font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="size-5 text-warn" />
            Open DVIR Defects <span className="text-muted-foreground text-sm font-normal">({openDefects.length} total)</span>
          </h2>
          {openDefects.length === 0 ? (
            <p className="text-muted-foreground text-sm">No open defects.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(defectsByBus).map(([busId, defects]) => (
                <div key={busId} className="bg-warn-surface border border-warn-border rounded-lg p-3">
                  <p className="text-warn font-semibold mb-1">Bus #{defects[0].bus_number}</p>
                  <ul className="space-y-1">
                    {defects.map(d => (
                      <li key={d.id} className="text-foreground text-sm flex items-start gap-2">
                        <span className="text-warn mt-0.5">•</span>
                        <span className="min-w-0">{d.description}</span>
                        <span className="text-muted-foreground text-xs ml-auto whitespace-nowrap">
                          {new Date(d.created_at).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Maintenance / Safety Hold detail ── */}
      {maintenanceQ.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-foreground font-semibold mb-3">OOS / Maintenance / Safety Hold</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {maintenanceQ.map(bus => (
                <div key={bus.id} className={`rounded-lg border p-3 ${busStatusColor(bus.status)}`}>
                  <p className="font-bold">#{bus.bus_number}</p>
                  <p className="text-xs capitalize">{busStatusLabel(bus.status)}</p>
                  {defectsByBus[bus.id] && (
                    <p className="text-xs opacity-80 mt-1">{defectsByBus[bus.id].length} open defect(s)</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
