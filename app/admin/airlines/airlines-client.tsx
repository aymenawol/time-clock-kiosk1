'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-5">
        <p className="text-muted-foreground text-sm">{airlines.length} airlines configured</p>
        <Button onClick={openNew} size="sm">
          <Plus className="size-4" /> Add Airline
        </Button>
      </div>

      {/* Form */}
      {editing !== null && (
        <Card className="p-5 sm:p-6 mb-6">
          <h3 className="text-foreground font-semibold mb-4">{editing.id ? 'Edit Airline' : 'New Airline'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Airline Name *</Label>
              <Input
                value={editing.name ?? ''}
                onChange={e => setEditing(p => ({ ...p!, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Terminal *</Label>
              <Input
                value={editing.terminal ?? ''}
                onChange={e => setEditing(p => ({ ...p!, terminal: e.target.value }))}
                placeholder="e.g. T-1, T-3, RAC"
              />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input
                value={editing.phone ?? ''}
                onChange={e => setEditing(p => ({ ...p!, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Wheelchair Contact</Label>
              <Input
                value={editing.wheelchair_contact ?? ''}
                onChange={e => setEditing(p => ({ ...p!, wheelchair_contact: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Notes</Label>
              <Textarea
                value={editing.notes ?? ''}
                onChange={e => setEditing(p => ({ ...p!, notes: e.target.value }))}
                rows={2}
                className="resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is-active"
                checked={editing.is_active ?? true}
                onChange={e => setEditing(p => ({ ...p!, is_active: e.target.checked }))}
              />
              <Label htmlFor="is-active">Active</Label>
            </div>
          </div>

          {error && <p className="text-danger text-sm mt-3">{error}</p>}

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <Button
              onClick={handleSave}
              disabled={isPending || !editing.name?.trim() || !editing.terminal?.trim()}
              variant="success"
            >
              {isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button onClick={closeForm} variant="ghost">
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
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
                    <Badge variant={a.is_active ? 'ok' : 'neutral'}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Button onClick={() => openEdit(a)} variant="ghost" size="sm">
                        Edit
                      </Button>
                      <Button onClick={() => handleToggle(a)} variant="ghost" size="sm">
                        {a.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
