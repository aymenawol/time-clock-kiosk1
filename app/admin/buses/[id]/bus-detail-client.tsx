'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Bus, BusStatusHistory, RepairNote } from '@/lib/supabase'
import { BUS_STATUS_LABELS, BUS_STATUS_COLOR } from '@/lib/supabase'
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
    if (!confirm(`Permanently delete bus #${bus.bus_number}? This cannot be undone.`)) return
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
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => router.push('/admin/buses')} className="text-sm text-muted-foreground hover:text-foreground mb-1">
            ← Fleet
          </button>
          <h1 className="text-2xl font-bold text-foreground">Bus #{bus.bus_number}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded border ${BUS_STATUS_COLOR[bus.status]}`}>
              {BUS_STATUS_LABELS[bus.status]}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              bus.bus_type === 'EV' ? 'bg-teal-900 text-teal-300' : 'bg-muted text-muted-foreground'
            }`}>
              {bus.bus_type}
            </span>
            {!bus.is_active && (
              <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">Inactive</span>
            )}
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="text-red-400 hover:text-red-300 text-sm border border-red-800 hover:border-red-600 rounded-lg px-3 py-1.5"
        >
          Delete
        </button>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-600 text-red-300 rounded-lg p-3 text-sm">{error}</div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-500 text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className="ml-1.5 bg-gray-700 text-foreground text-[10px] px-1.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="max-w-xl space-y-4">
          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bus Number">
                  <input name="bus_number" value={form.bus_number} onChange={e => setForm(p => ({...p, bus_number: e.target.value}))} className={INPUT} />
                </Field>
                <Field label="Type">
                  <select value={form.bus_type} onChange={e => setForm(p => ({...p, bus_type: e.target.value as 'EV'|'Diesel'}))} className={INPUT}>
                    <option value="Diesel">Diesel</option>
                    <option value="EV">EV</option>
                  </select>
                </Field>
              </div>
              <Field label="VIN">
                <input value={form.vin} onChange={e => setForm(p => ({...p, vin: e.target.value}))} className={INPUT} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fuel / Charge %">
                  <input type="number" min="0" max="100" value={form.fuel_level} onChange={e => setForm(p => ({...p, fuel_level: e.target.value}))} className={INPUT} />
                </Field>
                <Field label="Mileage">
                  <input type="number" min="0" value={form.current_mileage} onChange={e => setForm(p => ({...p, current_mileage: e.target.value}))} className={INPUT} />
                </Field>
              </div>
              <Field label="Notes">
                <textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} rows={3} className={INPUT} />
              </Field>
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={isPending} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-foreground text-sm font-medium px-4 py-2 rounded-lg">Save</button>
                <button onClick={() => setEditing(false)} className="bg-muted text-foreground text-sm px-4 py-2 rounded-lg">Cancel</button>
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
              <button onClick={() => setEditing(true)} className="bg-muted hover:bg-gray-700 text-foreground text-sm px-4 py-2 rounded-lg">Edit</button>
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
              <span className="text-gray-600">→</span>
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
              <span className="text-foreground">{s.employee?.name}</span>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded ${
                s.status === 'active' ? 'bg-green-900 text-green-300' :
                s.status === 'completed' ? 'bg-muted text-muted-foreground' : 'bg-card text-muted-foreground'
              }`}>{s.status}</span>
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
              r.is_resolved ? 'border-border opacity-60' : 'border-red-800'
            }`}>
              <div className="flex items-start justify-between">
                <span className="text-foreground font-medium">{r.defect_category} – {r.defect_item}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${r.is_resolved ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                  {r.is_resolved ? 'Resolved' : 'Open'}
                </span>
              </div>
              <p className="text-muted-foreground">{r.notes}</p>
              <p className="text-gray-600 text-xs">{new Date(r.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Inspections Tab */}
      {tab === 'inspections' && (
        <div className="space-y-3">
          {inspections.length === 0 && <p className="text-muted-foreground text-sm">No inspections found.</p>}
          {inspections.map((insp) => (
            <div key={insp.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-foreground text-sm font-medium">
                    {insp.driver ? insp.driver.name : 'Unknown Driver'}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {insp.inspection_type === 'pre_trip' ? 'Pre-Trip' : 'Post-Trip'} ·{' '}
                    {insp.inspection_date} ·{' '}
                    {insp.submitted_at ? new Date(insp.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not submitted'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {insp.has_defects && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-900 text-red-300">Defects</span>
                  )}
                  {insp.is_locked && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Locked</span>
                  )}
                </div>
              </div>
            </div>
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

const INPUT = 'w-full bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm'
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
