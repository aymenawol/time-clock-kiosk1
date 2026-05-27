'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { INSPECTION_CHECKLIST } from '@/lib/supabase'

interface InspectionItemRow {
  id?: string
  category: string
  item_name: string
  is_ok: boolean | null
  notes: string
}

interface Props {
  type: 'pre_trip' | 'post_trip'
  employee: { id: string; first_name: string; last_name: string } | null
  shift: { id: string; date: string; status: string; bus: { id: string; bus_number: string } | null } | null
  existingInspection: any | null
  existingItems: any[]
  today: string
}

const DAMAGE_COLORS = ['#ef4444', '#f97316', '#eab308', '#3b82f6']

type DrawTool = 'pen' | 'marker' | 'highlighter' | 'eraser'
const TOOLS: { key: DrawTool; label: string; width: number; opacity: number }[] = [
  { key: 'pen',         label: 'Pen',         width: 2,  opacity: 1   },
  { key: 'marker',      label: 'Marker',      width: 6,  opacity: 1   },
  { key: 'highlighter', label: 'Highlight',   width: 14, opacity: 0.5 },
  { key: 'eraser',      label: 'Eraser',      width: 20, opacity: 1   },
]

export default function InspectionClient({ type, employee, shift, existingInspection, existingItems, today }: Props) {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
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
  const [drawColor, setDrawColor] = useState(DAMAGE_COLORS[0])
  const [drawTool,  setDrawTool]  = useState<DrawTool>('pen')
  const [isDrawing, setIsDrawing] = useState(false)
  const [canUndo,   setCanUndo]   = useState(false)
  const historyRef = useRef<ImageData[]>([])

  const hasDefects = items.some(i => i.is_ok === false)
  const unchecked  = items.filter(i => i.is_ok === null).length

  function setItemOk(idx: number, ok: boolean | null) {
    setItems(prev => { const n = [...prev]; n[idx] = { ...n[idx], is_ok: ok }; return n })
  }
  function setItemNote(idx: number, note: string) {
    setItems(prev => { const n = [...prev]; n[idx] = { ...n[idx], notes: note }; return n })
  }

  // Drawing
  function getPos(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, c: HTMLCanvasElement) {
    const rect = c.getBoundingClientRect()
    const sx = c.width / rect.width, sy = c.height / rect.height
    if ('touches' in e) return { x: (e.touches[0].clientX - rect.left) * sx, y: (e.touches[0].clientY - rect.top) * sy }
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy }
  }
  function startDraw(e: any) {
    if (locked) return
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    historyRef.current.push(ctx.getImageData(0, 0, c.width, c.height))
    if (historyRef.current.length > 20) historyRef.current.shift()
    setCanUndo(true)
    setIsDrawing(true)
    const { x, y } = getPos(e, c)
    ctx.beginPath(); ctx.moveTo(x, y)
  }
  function doDraw(e: any) {
    if (!isDrawing) return
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const { x, y } = getPos(e, c)
    const tool = TOOLS.find(t => t.key === drawTool)!
    if (drawTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineWidth = tool.width; ctx.lineCap = 'round'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
      ctx.lineTo(x, y); ctx.stroke()
      ctx.globalCompositeOperation = 'source-over'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = tool.opacity
      ctx.lineWidth = tool.width; ctx.lineCap = 'round'; ctx.strokeStyle = drawColor
      ctx.lineTo(x, y); ctx.stroke()
      ctx.globalAlpha = 1
    }
  }
  function stopDraw() { setIsDrawing(false) }
  function undoDraw() {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx || historyRef.current.length === 0) return
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.putImageData(historyRef.current.pop()!, 0, 0)
    setCanUndo(historyRef.current.length > 0)
  }
  function clearDamage() {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    historyRef.current.push(ctx.getImageData(0, 0, c.width, c.height))
    if (historyRef.current.length > 20) historyRef.current.shift()
    setCanUndo(true)
    ctx.clearRect(0, 0, c.width, c.height)
  }

  async function saveInspection(submit = false) {
    if (!shift || !employee) return null
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const damageData = canvasRef.current?.toDataURL('image/png') ?? null
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
      damage_drawing:    damageData ? [{ type: 'image', data: damageData }] : [],
      ...(submit ? { is_locked: true, submitted_at: new Date().toISOString() } : {}),
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

    // Upsert inspection items
    await supabase.from('inspection_items').delete().eq('inspection_id', currentId)
    const { error: itemsErr } = await supabase.from('inspection_items').insert(
      items.map(i => ({
        inspection_id: currentId,
        category:      i.category,
        item_name:     i.item_name,
        is_ok:         i.is_ok,
        notes:         i.notes || null,
      }))
    )
    if (itemsErr) setError(itemsErr.message)

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
    }

    return currentId
  }

  function handleSaveDraft() {
    setError('')
    startTransition(async () => {
      await saveInspection(false)
      router.refresh()
    })
  }

  function handleSubmit() {
    if (unchecked > 0 && !confirm(`${unchecked} items unchecked. Submit anyway?`)) return
    setError('')
    startTransition(async () => {
      const id = await saveInspection(true)
      if (id) { setLocked(true); router.refresh() }
    })
  }

  const typeLabel = type === 'pre_trip' ? 'Pre-Trip Inspection' : 'Post-Trip Inspection'
  const categories = [...new Set(items.map(i => i.category))]

  if (!employee || !shift) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p>No active shift found for today.</p>
        <a href="/driver" className="text-blue-400 hover:underline text-sm mt-2 block">← Back to dashboard</a>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <a href="/driver" className="text-xs text-gray-500 hover:text-gray-300">← Dashboard</a>
          <h1 className="text-xl font-bold text-white mt-0.5">{typeLabel}</h1>
        </div>
        <div className="flex items-center gap-2">
          {locked && <span className="bg-green-900 text-green-300 text-xs font-semibold px-3 py-1 rounded-full">Submitted</span>}
          {hasDefects && <span className="bg-red-900 text-red-300 text-xs font-semibold px-3 py-1 rounded-full">Defects Found</span>}
        </div>
      </div>

      {error && <div className="bg-red-900/40 border border-red-600 text-red-300 rounded p-3 text-sm">{error}</div>}

      {/* Bus + times */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-gray-500 text-xs">Bus</p>
          <p className="text-white font-medium">{shift.bus ? `#${shift.bus.bus_number}` : '—'}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Driver</p>
          <p className="text-white">{employee.first_name} {employee.last_name}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-1">Start Time</p>
          <input type="time" value={startTime} disabled={locked} onChange={e => setStartTime(e.target.value)} className={INP_SM} />
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-1">End Time</p>
          <input type="time" value={endTime} disabled={locked} onChange={e => setEndTime(e.target.value)} className={INP_SM} />
        </div>
      </div>

      {/* Mileage */}
      {type === 'pre_trip' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Beginning Mileage</label>
            <input type="number" min="0" value={mileage.beginning} disabled={locked}
              onChange={e => setMileage(p => ({...p, beginning: e.target.value}))} className={INP} />
          </div>
          <div className="opacity-40">
            <label className="text-xs text-gray-400 block mb-1">Ending Mileage (post-trip)</label>
            <input type="number" disabled className={INP} placeholder="Entered on post-trip" />
          </div>
        </div>
      )}
      {type === 'post_trip' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Beginning Mileage (from pre-trip)</label>
            <input type="number" min="0" value={mileage.beginning} disabled={locked}
              onChange={e => setMileage(p => ({...p, beginning: e.target.value}))} className={INP} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Ending Mileage *</label>
            <input type="number" min="0" value={mileage.ending} disabled={locked}
              onChange={e => setMileage(p => ({...p, ending: e.target.value}))} className={INP} />
          </div>
          {mileage.beginning && mileage.ending && (
            <div className="col-span-2">
              <p className="text-gray-500 text-xs">Miles Driven: <span className="text-white font-medium">{parseInt(mileage.ending) - parseInt(mileage.beginning)}</span></p>
            </div>
          )}
        </div>
      )}

      {/* Checklist */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
          Checklist {unchecked > 0 && !locked && <span className="text-yellow-400 font-normal normal-case ml-2">({unchecked} remaining)</span>}
        </h2>
        {categories.map(cat => {
          const catItems = items.filter(i => i.category === cat)
          return (
            <div key={cat} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-gray-800/60 text-sm font-medium text-gray-300">{cat}</div>
              <div className="divide-y divide-gray-800">
                {catItems.map((item, globalIdx) => {
                  const idx = items.findIndex(i => i.category === item.category && i.item_name === item.item_name)
                  return (
                    <div key={idx} className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-white flex-1">{item.item_name}</span>
                        <div className="flex gap-1">
                          <button
                            disabled={locked}
                            onClick={() => setItemOk(idx, true)}
                            className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                              item.is_ok === true
                                ? 'bg-green-700 text-white'
                                : 'bg-gray-800 text-gray-500 hover:bg-green-900 hover:text-green-300'
                            } disabled:cursor-default`}
                          >OK</button>
                          <button
                            disabled={locked}
                            onClick={() => setItemOk(idx, false)}
                            className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                              item.is_ok === false
                                ? 'bg-red-700 text-white'
                                : 'bg-gray-800 text-gray-500 hover:bg-red-900 hover:text-red-300'
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
                          className="mt-1 w-full bg-gray-950 border border-red-800 text-white text-xs rounded px-2 py-1"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Damage drawing */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Damage Diagram</h2>
        <div className="space-y-2 mb-2">
          <div className="flex flex-wrap gap-1">
            {TOOLS.map(t => (
              <button
                key={t.key}
                disabled={locked}
                onClick={() => setDrawTool(t.key)}
                className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                  drawTool === t.key
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                } disabled:opacity-50`}
              >{t.label}</button>
            ))}
            <button
              disabled={locked || !canUndo}
              onClick={undoDraw}
              className="text-xs px-2.5 py-1 rounded border border-gray-700 bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 ml-auto"
            >Undo</button>
            <button
              onClick={clearDamage}
              disabled={locked}
              className="text-xs px-2 py-1 rounded border border-gray-700 bg-gray-800 text-gray-500 hover:text-red-300 hover:border-red-700 disabled:opacity-30"
            >Clear</button>
          </div>
          {drawTool !== 'eraser' && (
            <div className="flex gap-2">
              {DAMAGE_COLORS.map(c => (
                <button
                  key={c}
                  disabled={locked}
                  onClick={() => setDrawColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${drawColor === c ? 'border-white scale-110' : 'border-transparent opacity-70'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
        </div>
        {/* Bus outline SVG as background */}
        <div className="relative">
          <svg viewBox="0 0 400 200" className="w-full border border-gray-700 rounded bg-gray-950" xmlns="http://www.w3.org/2000/svg">
            {/* Simple bus top-down outline */}
            <rect x="20" y="30" width="360" height="140" rx="10" fill="none" stroke="#4b5563" strokeWidth="2"/>
            <rect x="20" y="30" width="50" height="140" rx="4" fill="none" stroke="#6b7280" strokeWidth="1.5"/>
            <rect x="330" y="30" width="50" height="140" rx="4" fill="none" stroke="#6b7280" strokeWidth="1.5"/>
            <line x1="70" y1="30" x2="70" y2="170" stroke="#374151" strokeWidth="1"/>
            <line x1="330" y1="30" x2="330" y2="170" stroke="#374151" strokeWidth="1"/>
            <circle cx="45" cy="20" r="8" fill="none" stroke="#6b7280" strokeWidth="1.5"/>
            <circle cx="355" cy="20" r="8" fill="none" stroke="#6b7280" strokeWidth="1.5"/>
            <circle cx="45" cy="180" r="8" fill="none" stroke="#6b7280" strokeWidth="1.5"/>
            <circle cx="355" cy="180" r="8" fill="none" stroke="#6b7280" strokeWidth="1.5"/>
            <text x="200" y="105" textAnchor="middle" fill="#374151" fontSize="12" fontFamily="sans-serif">TOP VIEW</text>
            <text x="45" y="105" textAnchor="middle" fill="#374151" fontSize="9" fontFamily="sans-serif">FRONT</text>
            <text x="355" y="105" textAnchor="middle" fill="#374151" fontSize="9" fontFamily="sans-serif">REAR</text>
          </svg>
          <canvas
            ref={canvasRef}
            width={400} height={200}
            className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
            style={{ opacity: locked ? 0.7 : 1, pointerEvents: locked ? 'none' : 'auto' }}
            onMouseDown={startDraw} onMouseMove={doDraw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
            onTouchStart={startDraw} onTouchMove={doDraw} onTouchEnd={stopDraw}
          />
        </div>
        <p className="text-gray-600 text-xs mt-1">Draw on diagram to mark damage locations.</p>
      </div>

      {/* Actions */}
      {!locked && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-800 p-4 flex gap-3">
          <button onClick={handleSaveDraft} disabled={isPending} className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-sm px-4 py-2 rounded-lg">
            Save Draft
          </button>
          <button onClick={handleSubmit} disabled={isPending} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm">
            {isPending ? 'Submitting…' : `Submit ${type === 'pre_trip' ? 'Pre-Trip' : 'Post-Trip'}`}
          </button>
        </div>
      )}
    </div>
  )
}

const INP    = 'w-full bg-gray-950 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50'
const INP_SM = 'w-full bg-gray-950 border border-gray-700 text-white rounded px-2 py-1 text-sm disabled:opacity-50'
