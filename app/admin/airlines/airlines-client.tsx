'use client'

import { useState, useTransition } from 'react'
import { upsertAirlineAction, toggleAirlineActiveAction, type AirlineInput } from './actions'

interface Airline extends AirlineInput { id: string }

export default function AirlinesClient({ airlines: initial }: { airlines: Airline[] }) {
  const [airlines, setAirlines]       = useState(initial)
  const [editing, setEditing]         = useState<Partial<Airline> | null>(null)
  const [isPending, startTransition]  = useTransition()
  const [error, setError]             = useState<string | null>(null)

  function openNew() {
    setEditing({ name: '', terminal: '', phone: '', wheelchair_contact: '', notes: '', is_active: true })
    setError(null)
  }
  function openEdit(a: Airline) { setEditing({ ...a }); setError(null) }
  function closeForm() { setEditing(null); setError(null) }

  function handleSave() {
    if (!editing?.name?.trim() || !editing?.terminal?.trim()) return
    setError(null)
    startTransition(async () => {
      const res = await upsertAirlineAction(editing as AirlineInput)
      if ('error' in res && res.error) { setError(res.error); return }
      closeForm()
    })
  }

  function handleToggle(a: Airline) {
    startTransition(async () => {
      await toggleAirlineActiveAction(a.id, !a.is_active)
      setAirlines(prev => prev.map(x => x.id === a.id ? { ...x, is_active: !x.is_active } : x))
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-muted-foreground text-sm">{airlines.length} airlines configured</p>
        <button
          onClick={openNew}
          className="bg-blue-700 hover:bg-blue-600 text-foreground px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Add Airline
        </button>
      </div>

      {/* Form */}
      {editing !== null && (
        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
          <h3 className="text-foreground font-semibold mb-4">{editing.id ? 'Edit Airline' : 'New Airline'}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Airline Name *</label>
              <input
                value={editing.name ?? ''}
                onChange={e => setEditing(p => ({ ...p!, name: e.target.value }))}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Terminal *</label>
              <input
                value={editing.terminal ?? ''}
                onChange={e => setEditing(p => ({ ...p!, terminal: e.target.value }))}
                placeholder="e.g. T-1, T-3, RAC"
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Phone</label>
              <input
                value={editing.phone ?? ''}
                onChange={e => setEditing(p => ({ ...p!, phone: e.target.value }))}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Wheelchair Contact</label>
              <input
                value={editing.wheelchair_contact ?? ''}
                onChange={e => setEditing(p => ({ ...p!, wheelchair_contact: e.target.value }))}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Notes</label>
              <textarea
                value={editing.notes ?? ''}
                onChange={e => setEditing(p => ({ ...p!, notes: e.target.value }))}
                rows={2}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is-active"
                checked={editing.is_active ?? true}
                onChange={e => setEditing(p => ({ ...p!, is_active: e.target.checked }))}
              />
              <label htmlFor="is-active" className="text-foreground text-sm">Active</label>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSave}
              disabled={isPending || !editing.name?.trim() || !editing.terminal?.trim()}
              className="bg-green-700 hover:bg-green-600 text-foreground px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground text-sm px-3">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs">
              <th className="text-left px-4 py-3">Airline</th>
              <th className="text-left px-4 py-3">Terminal</th>
              <th className="text-left px-4 py-3">Phone</th>
              <th className="text-left px-4 py-3">W/C Contact</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {airlines.map(a => (
              <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                <td className="px-4 py-3 text-foreground font-medium">{a.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.terminal}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.phone || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.wheelchair_contact || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.is_active ? 'bg-green-900 text-green-300' : 'bg-muted text-muted-foreground'}`}>
                    {a.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => openEdit(a)}
                      className="text-muted-foreground hover:text-foreground text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggle(a)}
                      className="text-gray-600 hover:text-yellow-400 text-xs"
                    >
                      {a.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
