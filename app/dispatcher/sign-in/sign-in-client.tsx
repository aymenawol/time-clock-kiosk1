'use client'

import { useRef, useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface Driver  { id: string; name: string; seniority_number: number | null }
interface BusOpt  { id: string; bus_number: string; bus_type: string; status: string; fuel_level: number | null }
interface Tablet  { id: string; tablet_number: string }
interface Shift   {
  id: string; date: string; status: string; scheduled_start: string | null; scheduled_end: string | null;
  actual_start: string | null; lunch_waiver: boolean; has_lunch: boolean;
  employee: { name: string } | null
  bus: { bus_number: string; bus_type: string } | null
  tablet: { tablet_number: string } | null
}

interface Props {
  drivers: Driver[]
  buses: BusOpt[]
  tablets: Tablet[]
  todayShifts: Shift[]
  today: string
}

export default function SignInClient({ drivers, buses, tablets, todayShifts, today }: Props) {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [shifts, setShifts] = useState<Shift[]>(todayShifts)

  const [form, setForm] = useState({
    employee_id:     '',
    bus_id:          '',
    tablet_id:       '',
    scheduled_start: '',
    scheduled_end:   '',
    has_lunch:       true,
    lunch_waiver:    false,
    notes:           '',
  })
  const [isDrawing, setIsDrawing] = useState(false)

  // Real-time subscription to keep sign-in list live
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const ch = supabase
      .channel('sign-in-sheet')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shifts' }, () => router.refresh())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [router])

  // ── Signature canvas ─────────────────────────────────────────────────────
  function startDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    setIsDrawing(true)
    ctx.beginPath()
    const { x, y } = getPos(e, canvasRef.current!)
    ctx.moveTo(x, y)
  }
  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (!isDrawing) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e, canvasRef.current!)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#ffffff'
    ctx.lineTo(x, y)
    ctx.stroke()
  }
  function stopDraw() { setIsDrawing(false) }
  function clearSig() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  }

  // ── Form submit ────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.employee_id) { setError('Select a driver.'); return }
    setError('')

    const signatureData = canvasRef.current?.toDataURL('image/png') ?? null

    startTransition(async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { error: err } = await supabase.from('shifts').insert({
        date:            today,
        employee_id:     form.employee_id,
        bus_id:          form.bus_id || null,
        tablet_id:       form.tablet_id || null,
        scheduled_start: form.scheduled_start || null,
        scheduled_end:   form.scheduled_end || null,
        has_lunch:       form.has_lunch,
        lunch_waiver:    form.lunch_waiver,
        signature_data:  signatureData,
        notes:           form.notes || null,
        status:          'active',
        actual_start:    new Date().toISOString(),
      })
      if (err) {
        setError(err.message)
      } else {
        setSuccess('Signed in!')
        setForm({ employee_id: '', bus_id: '', tablet_id: '', scheduled_start: '', scheduled_end: '', has_lunch: true, lunch_waiver: false, notes: '' })
        clearSig()
        setTimeout(() => { setSuccess(''); router.refresh() }, 1500)
      }
    })
  }

  const displayDate = new Date(today + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Sign-In Sheet — {displayDate}</h1>
        <button onClick={() => window.print()} className="text-sm text-gray-400 hover:text-white border border-gray-700 rounded px-3 py-1">
          🖨 Print
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Sign-in form */}
        <form onSubmit={handleSubmit} className="xl:col-span-2 space-y-4 bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h2 className="font-semibold text-white text-sm">New Sign-In</h2>

          {error   && <div className="bg-red-900/40 border border-red-600 text-red-300 rounded p-2 text-sm">{error}</div>}
          {success && <div className="bg-green-900/40 border border-green-600 text-green-300 rounded p-2 text-sm">{success}</div>}

          <div>
            <label className={LBL}>Driver *</label>
            <select required value={form.employee_id} onChange={e => setForm(p => ({...p, employee_id: e.target.value}))} className={SEL}>
              <option value="">Select driver…</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.seniority_number ? ` (#${d.seniority_number})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>Bus</label>
              <select value={form.bus_id} onChange={e => setForm(p => ({...p, bus_id: e.target.value}))} className={SEL}>
                <option value="">None</option>
                {buses.map(b => (
                  <option key={b.id} value={b.id}>#{b.bus_number} ({b.bus_type})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LBL}>Tablet</label>
              <select value={form.tablet_id} onChange={e => setForm(p => ({...p, tablet_id: e.target.value}))} className={SEL}>
                <option value="">None</option>
                {tablets.map(t => <option key={t.id} value={t.id}>{t.tablet_number}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>Sched. Start</label>
              <input type="time" value={form.scheduled_start} onChange={e => setForm(p => ({...p, scheduled_start: e.target.value}))} className={INP} />
            </div>
            <div>
              <label className={LBL}>Sched. End</label>
              <input type="time" value={form.scheduled_end} onChange={e => setForm(p => ({...p, scheduled_end: e.target.value}))} className={INP} />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={form.has_lunch} onChange={e => setForm(p => ({...p, has_lunch: e.target.checked}))} className="rounded" />
              Has lunch
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={form.lunch_waiver} onChange={e => setForm(p => ({...p, lunch_waiver: e.target.checked}))} className="rounded" />
              Lunch waiver
            </label>
          </div>

          <div>
            <label className={LBL}>Signature</label>
            <canvas
              ref={canvasRef}
              width={340} height={100}
              className="w-full border border-gray-700 rounded bg-gray-950 cursor-crosshair touch-none"
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
              onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
            />
            <button type="button" onClick={clearSig} className="text-xs text-gray-500 hover:text-gray-300 mt-1">Clear signature</button>
          </div>

          <div>
            <label className={LBL}>Notes</label>
            <input value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} className={INP} placeholder="Optional…" />
          </div>

          <button type="submit" disabled={isPending} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm">
            {isPending ? 'Signing in…' : 'Sign In Driver'}
          </button>
        </form>

        {/* Today's sign-in list */}
        <div className="xl:col-span-3 space-y-3">
          <h2 className="font-semibold text-white text-sm">Today's Sign-Ins ({shifts.length})</h2>
          {shifts.length === 0 ? (
            <p className="text-gray-600 text-sm">No sign-ins yet today.</p>
          ) : (
            <div className="overflow-auto rounded-xl border border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 text-gray-500 text-xs uppercase">
                    <th className="px-3 py-2 text-left">Driver</th>
                    <th className="px-3 py-2 text-left">Bus</th>
                    <th className="px-3 py-2 text-left">Tablet</th>
                    <th className="px-3 py-2 text-left">Start</th>
                    <th className="px-3 py-2 text-left">End</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {shifts.map(s => (
                    <tr key={s.id} className="hover:bg-gray-900/40">
                      <td className="px-3 py-2 text-white">{s.employee?.name}</td>
                      <td className="px-3 py-2 text-gray-400">{s.bus ? `#${s.bus.bus_number}` : '—'}</td>
                      <td className="px-3 py-2 text-gray-400">{s.tablet?.tablet_number ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-400">{s.scheduled_start ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-400">{s.scheduled_end ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          s.status === 'active'    ? 'bg-green-900 text-green-300' :
                          s.status === 'completed' ? 'bg-gray-800 text-gray-400' :
                          s.status === 'cancelled' ? 'bg-red-900 text-red-400' :
                          'bg-blue-900 text-blue-300'
                        }`}>{s.status}</span>
                        {s.lunch_waiver && <span className="ml-1 text-[10px] text-orange-400">LW</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const LBL = 'block text-xs text-gray-400 mb-1'
const INP = 'w-full bg-gray-950 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm'
const SEL = 'w-full bg-gray-950 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm'

function getPos(
  e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement
) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width  / rect.width
  const scaleY = canvas.height / rect.height
  if ('touches' in e) {
    const t = e.touches[0]
    return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY }
  }
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
}
