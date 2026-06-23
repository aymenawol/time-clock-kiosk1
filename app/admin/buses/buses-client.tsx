'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { Plus } from 'lucide-react'
import type { Bus, BusStatus } from '@/lib/supabase'
import { BUS_STATUS_LABELS, BUS_STATUS_COLOR } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { updateBusStatusAction } from './actions'

const STATUS_COLUMNS: { key: BusStatus | 'shop'; label: string; statuses: BusStatus[]; header: string }[] = [
  { key: 'ready',       label: 'Ready',       statuses: ['ready'],                                                    header: 'bg-ok-surface text-ok border-ok-border' },
  { key: 'in_service',  label: 'In Service',  statuses: ['in_service'],                                               header: 'bg-info-surface text-info border-info-border' },
  { key: 'shop',        label: 'Shop',        statuses: ['maintenance_pmi','shopped_dvir','maintenance_repair'],       header: 'bg-danger-surface text-danger border-danger-border' },
  { key: 'fueling',     label: 'Fueling',     statuses: ['charging','fuel','wash','training'],                        header: 'bg-warn-surface text-warn border-warn-border' } as any,
  { key: 'safety_hold', label: 'Safety Hold', statuses: ['safety_hold'],                                              header: 'bg-hazard-surface text-hazard border-hazard-border' },
  { key: 'salvage',     label: 'Salvage',     statuses: ['salvage'],                                                  header: 'bg-neutral-surface text-neutral border-neutral-border' },
]

const ALL_STATUSES: { value: BusStatus; label: string }[] = [
  { value: 'ready',               label: 'Ready' },
  { value: 'in_service',          label: 'In Service' },
  { value: 'charging',            label: 'Charging' },
  { value: 'fuel',                label: 'Fueling' },
  { value: 'wash',                label: 'Wash' },
  { value: 'maintenance_pmi',     label: 'PMI' },
  { value: 'shopped_dvir',        label: 'Shopped / DVIR' },
  { value: 'maintenance_repair',  label: 'Repair' },
  { value: 'safety_hold',         label: 'Safety Hold' },
  { value: 'salvage',             label: 'Salvage' },
  { value: 'training',            label: 'Training' },
]

interface Props {
  initialBuses: Bus[]
  serverError?: string
}

export default function BusesClient({ initialBuses, serverError }: Props) {
  const router = useRouter()
  const [buses, setBuses]               = useState<Bus[]>(initialBuses)
  const [statusBusId, setStatusBusId]   = useState<string | null>(null)
  const [pendingStatus, setPendingStatus] = useState<BusStatus | ''>('')
  const [isPending, startTransition]    = useTransition()

  // Real-time subscription
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const channel = supabase
      .channel('admin-bus-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buses' }, payload => {
        if (payload.eventType === 'INSERT') {
          setBuses(prev => [...prev, payload.new as Bus].sort((a, b) => a.bus_number.localeCompare(b.bus_number)))
        } else if (payload.eventType === 'UPDATE') {
          setBuses(prev => prev.map(b => b.id === payload.new.id ? payload.new as Bus : b))
        } else if (payload.eventType === 'DELETE') {
          setBuses(prev => prev.filter(b => b.id !== payload.old.id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  function handleStatusChange(busId: string, newStatus: BusStatus) {
    setStatusBusId(null)
    startTransition(async () => {
      await updateBusStatusAction(busId, newStatus)
    })
  }

  const activeBuses = buses.filter(b => b.is_active)
  const totalActive = activeBuses.filter(b => b.status === 'in_service').length
  const totalReady  = activeBuses.filter(b => b.status === 'ready').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Fleet Status Board</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalActive} in service · {totalReady} ready · {activeBuses.length} total active
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/admin/buses/new">
            <Plus />
            Add Bus
          </Link>
        </Button>
      </div>

      {serverError && (
        <div className="bg-danger-surface border border-danger-border text-danger rounded-lg p-3 text-sm">
          {serverError}
        </div>
      )}

      {/* Kanban columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {STATUS_COLUMNS.map(col => {
          const colBuses = activeBuses.filter(b => col.statuses.includes(b.status))
          return (
            <div key={col.key} className="flex flex-col gap-3">
              <div className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide flex justify-between ${col.header}`}>
                <span>{col.label}</span>
                <span className="opacity-70">{colBuses.length}</span>
              </div>
              <div className="flex flex-col gap-2 min-h-[120px]">
                {colBuses.map(bus => (
                  <BusCard
                    key={bus.id}
                    bus={bus}
                    isChangingStatus={statusBusId === bus.id}
                    onOpenStatusMenu={() => setStatusBusId(bus.id === statusBusId ? null : bus.id)}
                    pendingStatus={statusBusId === bus.id ? pendingStatus : ''}
                    onPendingChange={v => setPendingStatus(v as BusStatus)}
                    onStatusChange={handleStatusChange}
                    onClose={() => setStatusBusId(null)}
                    isPending={isPending}
                    onDetail={() => router.push(`/admin/buses/${bus.id}`)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Inactive buses */}
      {buses.filter(b => !b.is_active).length > 0 && (
        <details className="mt-4">
          <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
            {buses.filter(b => !b.is_active).length} inactive buses
          </summary>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            {buses.filter(b => !b.is_active).map(bus => (
              <Link
                key={bus.id}
                href={`/admin/buses/${bus.id}`}
                className="bg-card border border-border rounded-lg p-2 text-left text-sm text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                {bus.bus_number}
              </Link>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function BusCard({
  bus, isChangingStatus, onOpenStatusMenu, pendingStatus,
  onPendingChange, onStatusChange, onClose, isPending, onDetail,
}: {
  bus: Bus
  isChangingStatus: boolean
  onOpenStatusMenu: () => void
  pendingStatus: string
  onPendingChange: (v: string) => void
  onStatusChange: (id: string, s: BusStatus) => void
  onClose: () => void
  isPending: boolean
  onDetail: () => void
}) {
  return (
    <div className={`relative border rounded-lg p-3 text-sm cursor-default ${BUS_STATUS_COLOR[bus.status]}`}>
      <div className="flex items-start justify-between gap-1">
        <button onClick={onDetail} className="font-bold text-base leading-none hover:underline min-w-0 truncate">
          #{bus.bus_number}
        </button>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
          bus.bus_type === 'EV'
            ? 'bg-info-surface text-info border-info-border'
            : 'bg-muted text-muted-foreground border-border'
        }`}>
          {bus.bus_type}
        </span>
      </div>

      {bus.fuel_level != null && (
        <div className="mt-2">
          <div className="flex justify-between text-[10px] mb-0.5">
            <span>{bus.bus_type === 'EV' ? 'Charge' : 'Fuel'}</span>
            <span>{bus.fuel_level.toFixed(0)}%</span>
          </div>
          <div className="h-1 rounded-full bg-neutral-surface">
            <div
              className={`h-1 rounded-full transition-all ${
                bus.fuel_level > 50 ? 'bg-ok' :
                bus.fuel_level > 25 ? 'bg-warn' : 'bg-danger'
              }`}
              style={{ width: `${bus.fuel_level}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-2 flex gap-1">
        <button
          onClick={onOpenStatusMenu}
          className="flex-1 text-[10px] opacity-70 hover:opacity-100 border border-current rounded px-1 py-0.5 text-center"
        >
          Change status
        </button>
      </div>

      {isChangingStatus && (
        <div className="absolute left-0 top-full z-10 mt-1 w-48 bg-popover border border-border rounded-lg shadow-xl p-2">
          <select
            className="w-full bg-card border border-input text-foreground text-sm rounded px-2 py-1"
            value={pendingStatus}
            onChange={e => onPendingChange(e.target.value)}
            autoFocus
          >
            <option value="">— Select status —</option>
            {ALL_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <div className="flex gap-1 mt-2">
            <Button
              size="sm"
              className="flex-1"
              disabled={!pendingStatus || isPending}
              onClick={() => onStatusChange(bus.id, pendingStatus as BusStatus)}
            >
              Apply
            </Button>
            <Button size="sm" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
