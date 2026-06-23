'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { Bus, BusStatusHistory, RepairNote } from '@/lib/supabase'
import { BUS_STATUS_LABELS, BUS_STATUS_COLOR } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { updateBusStatusAction, updateBusAction, deleteBusAction } from '../actions'

type Tab = 'overview' | 'history' | 'shifts' | 'repairs' | 'inspections' | 'damage'

interface Shift { id: string; date: string; status: string; employee?: { name: string } }

interface Inspection {
  id: string
  inspection_type: string
  inspection_date: string
  is_locked: boolean
  submitted_at: string | null
  has_defects: boolean
  damage_drawing: Array<{ type: string; data: string }> | null
  driver: { name: string } | null
}

interface Props {
  bus: Bus
  history: BusStatusHistory[]
  shifts: Shift[]
  repairs: RepairNote[]
  inspections: Inspection[]
}

export default function BusDetailClient({ bus, history, shifts, repairs, inspections }: Props) {
  const router = useRouter()
  const [tab, setTab]                 = useState<Tab>('overview')
  const [isPending, startTransition]  = useTransition()
  const [editing, setEditing]         = useState(false)
  const [error, setError]             = useState('')
  const [form, setForm]               = useState({
    bus_number:      bus.bus_number,
    vin:             bus.vin ?? '',
    bus_type:        bus.bus_type,
    fuel_level:      bus.fuel_level?.toString() ?? '',
    current_mileage: bus.current_mileage?.toString() ?? '',
    notes:           bus.notes ?? '',
  })

  function handleSave() {
    setError('')
    startTransition(async () => {
      const res = await updateBusAction(bus.id, {
        bus_number:      form.bus_number,
        vin:             form.vin || null,
        bus_type:        form.bus_type as 'EV' | 'Diesel',
        fuel_level:      form.fuel_level ? parseFloat(form.fuel_level) : null,
        current_mileage: form.current_mileage ? parseInt(form.current_mileage) : null,
        notes:           form.notes || null,
      })
      if (res.error) setError(res.error)
      else setEditing(false)
    })
  }

  function handleDelete() {
    if (!confirm(`Retire bus #${bus.bus_number}? It will be moved to inactive (its history is kept) and can be reactivated later.`)) return
    startTransition(async () => {
      await deleteBusAction(bus.id)
      router.push('/admin/buses')
    })
  }

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview',     label: 'Overview' },
    { key: 'history',      label: 'Status History',  count: history.length },
    { key: 'shifts',       label: 'Shifts',           count: shifts.length },
    { key: 'repairs',      label: 'Repairs',          count: repairs.filter(r => !r.is_resolved).length },
    { key: 'inspections',  label: 'Inspections',      count: inspections.length },
    { key: 'damage',       label: 'Damage',           count: inspections.filter(i => (i.damage_drawing ?? []).some(d => d.type === 'image')).length },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <button onClick={() => router.push('/admin/buses')} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-1">
            <ArrowLeft className="size-4" />
            Fleet
          </button>
          <h1 className="text-2xl font-bold text-foreground">Bus #{bus.bus_number}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded border ${BUS_STATUS_COLOR[bus.status]}`}>
              {BUS_STATUS_LABELS[bus.status]}
            </span>
            <Badge variant={bus.bus_type === 'EV' ? 'info' : 'secondary'}>{bus.bus_type}</Badge>
            {!bus.is_active && (
              <Badge variant="neutral">Inactive</Badge>
            )}
          </div>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={isPending}
          className="shrink-0 self-start"
        >
          {bus.is_active ? 'Retire' : 'Retired'}
        </Button>
      </div>

      {error && (
        <div className="bg-danger-surface border border-danger-border text-danger rounded-lg p-3 text-sm">{error}</div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className="ml-1.5 bg-muted text-foreground text-[10px] px-1.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="max-w-xl space-y-4">
          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Bus Number">
                  <Input name="bus_number" value={form.bus_number} onChange={e => setForm(p => ({...p, bus_number: e.target.value}))} />
                </Field>
                <Field label="Type">
                  <select value={form.bus_type} onChange={e => setForm(p => ({...p, bus_type: e.target.value as 'EV'|'Diesel'}))} className={SELECT}>
                    <option value="Diesel">Diesel</option>
                    <option value="EV">EV</option>
                  </select>
                </Field>
              </div>
              <Field label="VIN">
                <Input value={form.vin} onChange={e => setForm(p => ({...p, vin: e.target.value}))} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Fuel / Charge %">
                  <Input type="number" min="0" max="100" value={form.fuel_level} onChange={e => setForm(p => ({...p, fuel_level: e.target.value}))} />
                </Field>
                <Field label="Mileage">
                  <Input type="number" min="0" value={form.current_mileage} onChange={e => setForm(p => ({...p, current_mileage: e.target.value}))} />
                </Field>
              </div>
              <Field label="Notes">
                <Textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} rows={3} />
              </Field>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={isPending}>Save</Button>
                <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <InfoRow label="VIN"         value={bus.vin ?? '—'} />
                <InfoRow label="Mileage"     value={bus.current_mileage ? bus.current_mileage.toLocaleString() + ' mi' : '—'} />
                <InfoRow label="Fuel/Charge" value={bus.fuel_level != null ? bus.fuel_level + '%' : '—'} />
                <InfoRow label="Active"      value={bus.is_active ? 'Yes' : 'No'} />
              </dl>
              {bus.notes && <p className="text-muted-foreground text-sm">{bus.notes}</p>}
              <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="space-y-2">
          {history.length === 0 && <p className="text-muted-foreground text-sm">No status history yet.</p>}
          {history.map(h => (
            <div key={h.id} className="flex items-center gap-3 text-sm border border-border rounded-lg px-3 py-2">
              <span className="text-muted-foreground text-xs w-36 shrink-0">
                {new Date(h.created_at).toLocaleString()}
              </span>
              <span className="text-muted-foreground">{h.from_status ?? '—'}</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-foreground font-medium">{BUS_STATUS_LABELS[h.to_status as keyof typeof BUS_STATUS_LABELS] ?? h.to_status}</span>
              {h.reason && <span className="text-muted-foreground text-xs ml-auto">{h.reason}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Shifts Tab */}
      {tab === 'shifts' && (
        <div className="space-y-2">
          {shifts.length === 0 && <p className="text-muted-foreground text-sm">No shifts recorded yet.</p>}
          {shifts.map((s: any) => (
            <div key={s.id} className="flex items-center gap-3 text-sm border border-border rounded-lg px-3 py-2">
              <span className="text-muted-foreground w-28 shrink-0">{s.date}</span>
              <span className="text-foreground min-w-0 truncate">{s.employee?.name}</span>
              <Badge
                variant={s.status === 'active' ? 'info' : s.status === 'completed' ? 'ok' : 'neutral'}
                className="ml-auto"
              >
                {s.status}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Repairs Tab */}
      {tab === 'repairs' && (
        <div className="space-y-2">
          {repairs.length === 0 && <p className="text-muted-foreground text-sm">No repair notes.</p>}
          {repairs.map(r => (
            <div key={r.id} className={`border rounded-lg px-3 py-3 text-sm space-y-1 ${
              r.is_resolved ? 'border-border opacity-60' : 'border-danger-border'
            }`}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-foreground font-medium min-w-0">{r.defect_category} – {r.defect_item}</span>
                <Badge variant={r.is_resolved ? 'ok' : 'danger'} className="shrink-0">
                  {r.is_resolved ? 'Resolved' : 'Open'}
                </Badge>
              </div>
              <p className="text-muted-foreground">{r.notes}</p>
              <p className="text-muted-foreground text-xs">{new Date(r.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Inspections Tab */}
      {tab === 'inspections' && (
        <div className="space-y-3">
          {inspections.length === 0 && <p className="text-muted-foreground text-sm">No inspections found.</p>}
          {inspections.map((insp) => (
            <Card key={insp.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4 sm:p-4">
                <div className="min-w-0">
                  <p className="text-foreground text-sm font-medium truncate">
                    {insp.driver ? insp.driver.name : 'Unknown Driver'}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {insp.inspection_type === 'pre_trip' ? 'Pre-Trip' : 'Post-Trip'} ·{' '}
                    {insp.inspection_date} ·{' '}
                    {insp.submitted_at ? new Date(insp.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not submitted'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                  {insp.has_defects && (
                    <Badge variant="danger">Defects</Badge>
                  )}
                  {insp.is_locked && (
                    <Badge variant="neutral">Locked</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Damage Tab */}
      {tab === 'damage' && (
        <div className="space-y-6">
          {inspections.every(i => !(i.damage_drawing ?? []).some(d => d.type === 'image')) && (
            <p className="text-muted-foreground text-sm">No damage markings recorded.</p>
          )}
          {inspections
            .filter(i => (i.damage_drawing ?? []).some(d => d.type === 'image'))
            .map(insp => {
              const images = (insp.damage_drawing ?? []).filter(d => d.type === 'image' && d.data)
              return (
                <div key={insp.id} className="space-y-2">
                  <p className="text-muted-foreground text-sm">
                    {insp.inspection_type === 'pre_trip' ? 'Pre-Trip' : 'Post-Trip'} — {insp.inspection_date}
                    {insp.driver ? ` · ${insp.driver.name}` : ''}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {images.map((img, idx) => (
                      <img key={idx} src={img.data} alt={`Damage ${idx + 1}`} className="rounded-lg border border-border max-w-xs" />
                    ))}
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

const SELECT = 'flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:border-ring'
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs text-muted-foreground mb-1">{label}</label>{children}</div>
}
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </>
  )
}
