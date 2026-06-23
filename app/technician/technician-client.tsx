'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Plus, CheckCircle2, Camera, Loader2, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface Bus {
  id: string; bus_number: string; bus_type: string; status: string; fuel_level: number | null
}
interface RepairNote {
  id: string; notes: string; photo_urls: string[] | null; is_resolved: boolean
  resolved_at: string | null; created_at: string
  defect_category: string | null; defect_item: string | null
  bus: { id: string; bus_number: string; bus_type: string; status: string } | null
  inspection: { id: string; inspection_type: string; inspection_date: string; driver_id: string } | null
}

interface Props {
  initialRepairNotes: RepairNote[]
  buses: Bus[]
}

const BUS_STATUS_READY = ['ready', 'in_service', 'charging'] as const

export default function TechnicianClient({ initialRepairNotes, buses }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  // Add repair note form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ bus_id: '', defect_category: '', defect_item: '', notes: '' })

  // Track locally updated photo_urls
  const [photoUrlsMap, setPhotoUrlsMap] = useState<Record<string, string[]>>(
    Object.fromEntries(initialRepairNotes.map(n => [n.id, n.photo_urls ?? []]))
  )

  // Group open defects by bus
  const byBus: Record<string, { bus: RepairNote['bus']; notes: RepairNote[] }> = {}
  for (const n of initialRepairNotes) {
    const key = n.bus?.id ?? 'unknown'
    if (!byBus[key]) byBus[key] = { bus: n.bus, notes: [] }
    byBus[key].notes.push(n)
  }

  async function uploadPhoto(noteId: string, file: File) {
    setUploadingId(noteId)
    setError('')
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${noteId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('repairs')
      .upload(path, file, { contentType: file.type, upsert: false })
    if (upErr) { setError(upErr.message); setUploadingId(null); return }

    const { data: urlData } = supabase.storage.from('repairs').getPublicUrl(path)
    const publicUrl = urlData?.publicUrl ?? ''

    // Update repair_note.photo_urls
    const existing = photoUrlsMap[noteId] ?? []
    const newUrls = [...existing, publicUrl]
    const { error: dbErr } = await supabase
      .from('repair_notes')
      .update({ photo_urls: newUrls })
      .eq('id', noteId)
    if (dbErr) { setError(dbErr.message) } else {
      setPhotoUrlsMap(prev => ({ ...prev, [noteId]: newUrls }))
    }
    setUploadingId(null)
  }

  async function markResolved(noteId: string, busId: string | null, markReady: boolean) {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { error: err } = await supabase
      .from('repair_notes')
      .update({ is_resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', noteId)
    if (err) { setError(err.message); return }

    if (markReady && busId) {
      await supabase.from('buses').update({ status: 'ready' }).eq('id', busId)
    }
    router.refresh()
  }

  function handleMarkResolved(note: RepairNote) {
    const busHasOthers = initialRepairNotes.filter(n => n.bus?.id === note.bus?.id && n.id !== note.id).length > 0
    const offerReady   = note.bus && !busHasOthers && !BUS_STATUS_READY.includes(note.bus.status as any)
    const markReady    = offerReady ? confirm(`Also mark Bus #${note.bus!.bus_number} as Ready?`) : false
    startTransition(() => markResolved(note.id, note.bus?.id ?? null, markReady))
  }

  async function handleAddNote() {
    if (!form.bus_id || !form.notes) { setError('Bus and notes are required.'); return }
    setError('')
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { error: err } = await supabase.from('repair_notes').insert({
      bus_id:          form.bus_id,
      defect_category: form.defect_category || null,
      defect_item:     form.defect_item || null,
      notes:           form.notes,
      is_resolved:     false,
    })
    if (err) { setError(err.message); return }
    setForm({ bus_id: '', defect_category: '', defect_item: '', notes: '' })
    setShowForm(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">Open Defects</h1>
        <div className="flex items-center gap-2">
          <Badge variant="danger" className="text-sm font-semibold px-3 py-1">
            {initialRepairNotes.length} open
          </Badge>
          <Button onClick={() => setShowForm(v => !v)} size="sm">
            <Plus />
            Log Defect
          </Button>
        </div>
      </div>

      {error && <div className="bg-danger-surface border border-danger-border text-danger rounded-lg p-3 text-sm">{error}</div>}

      {/* Add defect form */}
      {showForm && (
        <Card className="p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Log New Defect</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground block mb-1">Bus *</Label>
              <select value={form.bus_id} onChange={e => setForm(p => ({...p, bus_id: e.target.value}))} className={SEL}>
                <option value="">Select bus…</option>
                {buses.map(b => (
                  <option key={b.id} value={b.id}>#{b.bus_number} ({b.bus_type}) — {b.status}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground block mb-1">Category</Label>
              <Input
                value={form.defect_category}
                onChange={e => setForm(p => ({...p, defect_category: e.target.value}))}
                placeholder="e.g. Lights"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground block mb-1">Item</Label>
              <Input
                value={form.defect_item}
                onChange={e => setForm(p => ({...p, defect_item: e.target.value}))}
                placeholder="e.g. Left headlight"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground block mb-1">Notes *</Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm(p => ({...p, notes: e.target.value}))}
              rows={3}
              placeholder="Describe the defect…"
              className="resize-none"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleAddNote} disabled={isPending}>
              {isPending ? 'Saving…' : 'Log Defect'}
            </Button>
          </div>
        </Card>
      )}

      {/* No defects */}
      {initialRepairNotes.length === 0 && (
        <Card className="p-10 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-ok" />
          <p className="text-ok font-semibold text-lg">All Clear!</p>
          <p className="text-muted-foreground text-sm mt-1">No open defects.</p>
        </Card>
      )}

      {/* Defects grouped by bus */}
      {Object.entries(byBus).map(([busId, group]) => (
        <Card key={busId} className="overflow-hidden">
          <div className="px-4 py-3 bg-muted/60 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <Wrench className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-foreground font-bold truncate">
                {group.bus ? `Bus #${group.bus.bus_number}` : 'Unknown Bus'}
              </span>
              {group.bus && (
                <span className="text-muted-foreground text-xs truncate">{group.bus.bus_type} — {group.bus.status}</span>
              )}
            </div>
            <span className="text-danger text-sm font-medium">{group.notes.length} defect{group.notes.length > 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-border">
            {group.notes.map(note => (
              <div key={note.id} className="px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    {(note.defect_category || note.defect_item) && (
                      <p className="text-xs text-muted-foreground mb-0.5">
                        {[note.defect_category, note.defect_item].filter(Boolean).join(' / ')}
                      </p>
                    )}
                    <p className="text-foreground text-sm">{note.notes}</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {note.inspection && (
                        <span className="ml-2">via {note.inspection.inspection_type.replace('_', '-')} inspection</span>
                      )}
                    </p>
                    {/* Photo thumbnails */}
                    {(photoUrlsMap[note.id] ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {(photoUrlsMap[note.id] ?? []).map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt={`Repair photo ${i + 1}`}
                              className="w-16 h-16 object-cover rounded-lg border border-border hover:opacity-80" />
                          </a>
                        ))}
                      </div>
                    )}
                    {/* Photo upload */}
                    <label className={`mt-2 inline-flex items-center gap-1.5 text-xs ${
                      uploadingId === note.id ? 'text-muted-foreground pointer-events-none' : 'text-muted-foreground hover:text-foreground'
                    }`}>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingId === note.id}
                        onChange={e => { if (e.target.files?.[0]) uploadPhoto(note.id, e.target.files[0]) }}
                      />
                      {uploadingId === note.id ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
                      ) : (
                        <><Camera className="h-3.5 w-3.5" /> Add Photo</>
                      )}
                    </label>
                  </div>
                  <Button
                    onClick={() => handleMarkResolved(note)}
                    disabled={isPending}
                    variant="success"
                    size="sm"
                    className="whitespace-nowrap"
                  >
                    <CheckCircle2 />
                    Mark Resolved
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

const SEL = 'flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50'
