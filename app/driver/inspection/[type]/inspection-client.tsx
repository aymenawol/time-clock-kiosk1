'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { INSPECTION_CHECKLIST } from '@/lib/supabase'
import { flagBusOutOfServiceAction } from '@/app/driver/actions'
import DamageBoard from '@/components/damage-board'
import { parseDamageStrokes, type DamageStroke } from '@/lib/damage'

interface InspectionItemRow {
  id?: string
  category: string
  item_name: string
  is_ok: boolean | null
  notes: string
}

interface Props {
  type: 'pre_trip' | 'post_trip'
  employee: { id: string; name: string } | null
  shift: { id: string; date: string; status: string; bus: { id: string; bus_number: string } | null } | null
  existingInspection: any | null
  existingItems: any[]
  today: string
}

export default function InspectionClient({ type, employee, shift, existingInspection, existingItems, today }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(existingInspection?.is_locked ?? false)
  const [inspectionId, setInspectionId] = useState<string | null>(existingInspection?.id ?? null)

  const [mileage, setMileage] = useState({
    beginning: existingInspection?.beginning_mileage?.toString() ?? '',
    ending:    existingInspection?.ending_mileage?.toString() ?? '',
  })
  const [startTime, setStartTime] = useState(existingInspection?.start_time ?? '')
  const [endTime,   setEndTime]   = useState(existingInspection?.end_time ?? '')

  // Build items state from checklist template or existing items
  const buildItems = (): InspectionItemRow[] => {
    if (existingItems.length > 0) {
      return existingItems.map(i => ({ id: i.id, category: i.category, item_name: i.item_name, is_ok: i.is_ok, notes: i.notes ?? '' }))
    }
    return INSPECTION_CHECKLIST.flatMap(cat =>
      cat.items.map(item => ({ category: cat.category, item_name: item, is_ok: null, notes: '' }))
    )
  }

  const [items, setItems] = useState<InspectionItemRow[]>(buildItems)
  const [damageStrokes, setDamageStrokes] = useState<DamageStroke[]>(
    () => parseDamageStrokes(existingInspection?.damage_drawing) ?? []
  )

  const hasDefects = items.some(i => i.is_ok === false)
  const unchecked  = items.filter(i => i.is_ok === null).length

  function setItemOk(idx: number, ok: boolean | null) {
    setItems(prev => { const n = [...prev]; n[idx] = { ...n[idx], is_ok: ok }; return n })
  }
  function setItemNote(idx: number, note: string) {
    setItems(prev => { const n = [...prev]; n[idx] = { ...n[idx], notes: note }; return n })
  }

  async function saveInspection(submit = false) {
    if (!shift || !employee) return null
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    let currentId = inspectionId

    const payload = {
      shift_id:          shift.id,
      inspection_type:   type,
      bus_id:            shift.bus?.id ?? null,
      driver_id:         employee.id,
      inspection_date:   today,
      start_time:        startTime || null,
      end_time:          endTime || null,
      beginning_mileage: mileage.beginning ? parseInt(mileage.beginning) : null,
      ending_mileage:    mileage.ending ? parseInt(mileage.ending) : null,
      miles_driven:      (mileage.beginning && mileage.ending)
        ? parseInt(mileage.ending) - parseInt(mileage.beginning) : null,
      has_defects:       hasDefects,
      damage_drawing:    damageStrokes,
      ...(submit ? { is_locked: true, submitted_at: new Date().toISOString() } : {}),
    }

    const itemsPayload = items.map(i => ({
      category:  i.category,
      item_name: i.item_name,
      is_ok:     i.is_ok,
      notes:     i.notes || null,
    }))

    // Offline → queue the inspection (header + items); DriverShell syncs on reconnect.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const { queueWrite } = await import('@/lib/indexed-db')
      await queueWrite('pending_inspections', `insp-${shift.id}-${type}`, { inspection: payload, items: itemsPayload })
      return 'offline'
    }

    if (!currentId) {
      const { data, error: err } = await supabase
        .from('vehicle_inspections')
        .insert(payload)
        .select('id')
        .single()
      if (err) { setError(err.message); return null }
      currentId = data.id
      setInspectionId(currentId)
    } else {
      const { error: err } = await supabase
        .from('vehicle_inspections')
        .update(payload)
        .eq('id', currentId)
      if (err) { setError(err.message); return null }
    }

    // Replace items by inserting the new set FIRST, then deleting the prior
    // rows. Insert-before-delete guarantees a failed save can never wipe the
    // checklist (the old delete-then-insert lost all items if the insert
    // errored). A failed delete only leaves duplicates, self-healed on next save.
    const { data: insertedItems, error: itemsErr } = await supabase
      .from('inspection_items')
      .insert(itemsPayload.map(it => ({ ...it, inspection_id: currentId })))
      .select('id')
    if (itemsErr) { setError(itemsErr.message); return null }
    const insertedItemIds = (insertedItems ?? []).map((r: { id: string }) => r.id)
    let delItems = supabase.from('inspection_items').delete().eq('inspection_id', currentId)
    if (insertedItemIds.length > 0) delItems = delItems.not('id', 'in', `(${insertedItemIds.join(',')})`)
    const { error: delItemsErr } = await delItems
    if (delItemsErr) { setError(delItemsErr.message); return null }

    // If has defects, auto-insert repair notes
    if (hasDefects) {
      const defectItems = items.filter(i => i.is_ok === false)
      await supabase.from('repair_notes').insert(
        defectItems.map(i => ({
          bus_id:          shift.bus?.id,
          inspection_id:   currentId,
          defect_category: i.category,
          defect_item:     i.item_name,
          notes:           i.notes || 'Reported via pre/post-trip inspection.',
          is_resolved:     false,
        })).filter(r => r.bus_id)
      )

      // On final submit, take the bus out of service + alert techs/dispatch
      // (server action — drivers can't update bus status via RLS).
      if (submit && shift.bus?.id) {
        await flagBusOutOfServiceAction(shift.bus.id, shift.id, shift.bus.bus_number ?? null)
      }
    }

    return currentId
  }

  function handleSaveDraft() {
    setError('')
    startTransition(async () => {
      const id = await saveInspection(false)
      if (id && id !== 'offline') router.refresh()
    })
  }

  function handleSubmit() {
    if (unchecked > 0 && !confirm(`${unchecked} items unchecked. Submit anyway?`)) return
    setError('')
    startTransition(async () => {
      const id = await saveInspection(true)
      if (id === 'offline') {
        setError('You are offline — the inspection was saved on this device. Submit again once you reconnect.')
        return
      }
      if (id) { setLocked(true); router.refresh() }
    })
  }

  const typeLabel = type === 'pre_trip' ? 'Pre-Trip Inspection' : 'Post-Trip Inspection'
  const categories = [...new Set(items.map(i => i.category))]

  if (!employee || !shift) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>No active shift found for today.</p>
        <Link href="/driver" className="text-primary hover:underline text-sm mt-2 inline-flex items-center gap-1">
          <ArrowLeft className="size-4" /> Back to dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/driver" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="size-3.5" /> Dashboard
          </Link>
          <h1 className="text-xl font-bold text-foreground mt-0.5">{typeLabel}</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {locked && <Badge variant="ok">Submitted</Badge>}
          {hasDefects && <Badge variant="danger">Defects Found</Badge>}
        </div>
      </div>

      {error && (
        <div className="bg-danger-surface border border-danger-border text-danger rounded-lg p-3 text-sm">{error}</div>
      )}

      {/* Bus + times */}
      <Card className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">Bus</p>
          <p className="text-foreground font-medium">{shift.bus ? `#${shift.bus.bus_number}` : '—'}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Driver</p>
          <p className="text-foreground">{employee.name}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs mb-1">Start Time</p>
          <input type="time" value={startTime} disabled={locked} onChange={e => setStartTime(e.target.value)} className={INP_SM} />
        </div>
        <div>
          <p className="text-muted-foreground text-xs mb-1">End Time</p>
          <input type="time" value={endTime} disabled={locked} onChange={e => setEndTime(e.target.value)} className={INP_SM} />
        </div>
      </Card>

      {/* Mileage */}
      {type === 'pre_trip' && (
        <Card className="p-4 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Beginning Mileage</label>
            <input type="number" min="0" value={mileage.beginning} disabled={locked}
              onChange={e => setMileage(p => ({...p, beginning: e.target.value}))} className={INP} />
          </div>
          <div className="opacity-40">
            <label className="text-xs text-muted-foreground block mb-1">Ending Mileage (post-trip)</label>
            <input type="number" disabled className={INP} placeholder="Entered on post-trip" />
          </div>
        </Card>
      )}
      {type === 'post_trip' && (
        <Card className="p-4 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Beginning Mileage (from pre-trip)</label>
            <input type="number" min="0" value={mileage.beginning} disabled={locked}
              onChange={e => setMileage(p => ({...p, beginning: e.target.value}))} className={INP} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Ending Mileage *</label>
            <input type="number" min="0" value={mileage.ending} disabled={locked}
              onChange={e => setMileage(p => ({...p, ending: e.target.value}))} className={INP} />
          </div>
          {mileage.beginning && mileage.ending && (
            <div className="col-span-2">
              <p className="text-muted-foreground text-xs">Miles Driven: <span className="text-foreground font-medium">{parseInt(mileage.ending) - parseInt(mileage.beginning)}</span></p>
            </div>
          )}
        </Card>
      )}

      {/* Checklist */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Checklist {unchecked > 0 && !locked && <span className="text-warn font-normal normal-case ml-2">({unchecked} remaining)</span>}
        </h2>
        {categories.map(cat => {
          const catItems = items.filter(i => i.category === cat)
          return (
            <Card key={cat} className="overflow-hidden">
              <div className="px-4 py-2 bg-muted/60 text-sm font-medium text-foreground">{cat}</div>
              <div className="divide-y divide-border">
                {catItems.map((item, globalIdx) => {
                  const idx = items.findIndex(i => i.category === item.category && i.item_name === item.item_name)
                  return (
                    <div key={idx} className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-foreground flex-1 min-w-0">{item.item_name}</span>
                        <div className="flex gap-1.5">
                          <button
                            disabled={locked}
                            onClick={() => setItemOk(idx, true)}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                              item.is_ok === true
                                ? 'bg-ok text-white'
                                : 'bg-muted text-muted-foreground hover:bg-ok-surface hover:text-ok'
                            } disabled:cursor-default`}
                          >OK</button>
                          <button
                            disabled={locked}
                            onClick={() => setItemOk(idx, false)}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                              item.is_ok === false
                                ? 'bg-danger text-white'
                                : 'bg-muted text-muted-foreground hover:bg-danger-surface hover:text-danger'
                            } disabled:cursor-default`}
                          >DEF</button>
                        </div>
                      </div>
                      {item.is_ok === false && (
                        <input
                          placeholder="Describe defect…"
                          value={item.notes}
                          disabled={locked}
                          onChange={e => setItemNote(idx, e.target.value)}
                          className="mt-2 w-full bg-card border border-danger-border text-foreground text-xs rounded-lg px-2.5 py-2"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Damage drawing — structured strokes, multiple diagram views (N11) */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Damage Diagram</h2>
        <DamageBoard value={damageStrokes} onChange={setDamageStrokes} disabled={locked} />
      </Card>

      {/* Actions */}
      {!locked && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border p-4 flex gap-3">
          <Button variant="secondary" size="lg" onClick={handleSaveDraft} disabled={isPending}>
            Save Draft
          </Button>
          <Button size="lg" onClick={handleSubmit} disabled={isPending} className="flex-1">
            {isPending ? 'Submitting…' : `Submit ${type === 'pre_trip' ? 'Pre-Trip' : 'Post-Trip'}`}
          </Button>
        </div>
      )}
    </div>
  )
}

const INP    = 'w-full bg-card border border-input text-foreground rounded-lg px-3 py-2 text-sm disabled:opacity-50'
const INP_SM = 'w-full bg-card border border-input text-foreground rounded px-2 py-1 text-sm disabled:opacity-50'
