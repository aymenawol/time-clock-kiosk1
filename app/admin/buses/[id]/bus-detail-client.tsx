'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Bus, BusStatusHistory, RepairNote } from '@/lib/supabase'
import { BUS_STATUS_LABELS, BUS_STATUS_COLOR } from '@/lib/supabase'
import { updateBusStatusAction, updateBusAction, deleteBusAction } from '../actions'

type Tab = 'overview' | 'history' | 'shifts' | 'repairs'

interface Shift { id: string; date: string; status: string; employee?: { first_name: string; last_name: string } }

interface Props {
  bus: Bus
  history: BusStatusHistory[]
  shifts: Shift[]
  repairs: RepairNote[]
}

export default function BusDetailClient({ bus, history, shifts, repairs }: Props) {
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
    { key: 'overview', label: 'Overview' },
    { key: 'history',  label: 'Status History', count: history.length },
    { key: 'shifts',   label: 'Shifts',          count: shifts.length },
    { key: 'repairs',  label: 'Repairs',          count: repairs.filter(r => !r.is_resolved).length },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => router.push('/admin/buses')} className="text-sm text-gray-500 hover:text-gray-300 mb-1">
            ← Fleet
          </button>
          <h1 className="text-2xl font-bold text-white">Bus #{bus.bus_number}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded border ${BUS_STATUS_COLOR[bus.status]}`}>
              {BUS_STATUS_LABELS[bus.status]}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              bus.bus_type === 'EV' ? 'bg-teal-900 text-teal-300' : 'bg-gray-800 text-gray-400'
            }`}>
              {bus.bus_type}
            </span>
            {!bus.is_active && (
              <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-500">Inactive</span>
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
      <div className="flex gap-1 border-b border-gray-800">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className="ml-1.5 bg-gray-700 text-gray-300 text-[10px] px-1.5 rounded-full">{t.count}</span>
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
                <button onClick={handleSave} disabled={isPending} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">Save</button>
                <button onClick={() => setEditing(false)} className="bg-gray-800 text-gray-300 text-sm px-4 py-2 rounded-lg">Cancel</button>
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
              {bus.notes && <p className="text-gray-400 text-sm">{bus.notes}</p>}
              <button onClick={() => setEditing(true)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg">Edit</button>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="space-y-2">
          {history.length === 0 && <p className="text-gray-500 text-sm">No status history yet.</p>}
          {history.map(h => (
            <div key={h.id} className="flex items-center gap-3 text-sm border border-gray-800 rounded-lg px-3 py-2">
              <span className="text-gray-500 text-xs w-36 shrink-0">
                {new Date(h.created_at).toLocaleString()}
              </span>
              <span className="text-gray-400">{h.from_status ?? '—'}</span>
              <span className="text-gray-600">→</span>
              <span className="text-white font-medium">{BUS_STATUS_LABELS[h.to_status as keyof typeof BUS_STATUS_LABELS] ?? h.to_status}</span>
              {h.reason && <span className="text-gray-500 text-xs ml-auto">{h.reason}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Shifts Tab */}
      {tab === 'shifts' && (
        <div className="space-y-2">
          {shifts.length === 0 && <p className="text-gray-500 text-sm">No shifts recorded yet.</p>}
          {shifts.map((s: any) => (
            <div key={s.id} className="flex items-center gap-3 text-sm border border-gray-800 rounded-lg px-3 py-2">
              <span className="text-gray-500 w-28 shrink-0">{s.date}</span>
              <span className="text-white">{s.employee?.first_name} {s.employee?.last_name}</span>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded ${
                s.status === 'active' ? 'bg-green-900 text-green-300' :
                s.status === 'completed' ? 'bg-gray-800 text-gray-400' : 'bg-gray-900 text-gray-500'
              }`}>{s.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Repairs Tab */}
      {tab === 'repairs' && (
        <div className="space-y-2">
          {repairs.length === 0 && <p className="text-gray-500 text-sm">No repair notes.</p>}
          {repairs.map(r => (
            <div key={r.id} className={`border rounded-lg px-3 py-3 text-sm space-y-1 ${
              r.is_resolved ? 'border-gray-800 opacity-60' : 'border-red-800'
            }`}>
              <div className="flex items-start justify-between">
                <span className="text-white font-medium">{r.defect_category} – {r.defect_item}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${r.is_resolved ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                  {r.is_resolved ? 'Resolved' : 'Open'}
                </span>
              </div>
              <p className="text-gray-400">{r.notes}</p>
              <p className="text-gray-600 text-xs">{new Date(r.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const INPUT = 'w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm'
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs text-gray-400 mb-1">{label}</label>{children}</div>
}
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-white">{value}</dd>
    </>
  )
}
