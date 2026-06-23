'use client'

import { useRef, useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Printer } from 'lucide-react'
import { useDebouncedRefresh } from '@/lib/use-debounced-refresh'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

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
  const debouncedRefresh = useDebouncedRefresh()
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shifts', filter: `date=eq.${today}` }, debouncedRefresh)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [debouncedRefresh, today])

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
    ctx.strokeStyle = '#111827'
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-foreground">Sign-In Sheet — {displayDate}</h1>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer aria-hidden />
          Print
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Sign-in form */}
        <form onSubmit={handleSubmit} className="xl:col-span-2 space-y-4 bg-card rounded-xl border border-border p-4">
          <h2 className="font-semibold text-foreground text-sm">New Sign-In</h2>

          {error   && <div className="bg-danger-surface border border-danger-border text-danger rounded p-2 text-sm">{error}</div>}
          {success && <div className="bg-ok-surface border border-ok-border text-ok rounded p-2 text-sm">{success}</div>}

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
              <Input type="time" value={form.scheduled_start} onChange={e => setForm(p => ({...p, scheduled_start: e.target.value}))} />
            </div>
            <div>
              <label className={LBL}>Sched. End</label>
              <Input type="time" value={form.scheduled_end} onChange={e => setForm(p => ({...p, scheduled_end: e.target.value}))} />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={form.has_lunch} onChange={e => setForm(p => ({...p, has_lunch: e.target.checked}))} className="rounded" />
              Has lunch
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={form.lunch_waiver} onChange={e => setForm(p => ({...p, lunch_waiver: e.target.checked}))} className="rounded" />
              Lunch waiver
            </label>
          </div>

          <div>
            <label className={LBL}>Signature</label>
            <canvas
              ref={canvasRef}
              width={340} height={100}
              className="w-full border border-input rounded bg-white cursor-crosshair touch-none"
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
              onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
            />
            <button type="button" onClick={clearSig} className="text-xs text-muted-foreground hover:text-foreground mt-1">Clear signature</button>
          </div>

          <div>
            <label className={LBL}>Notes</label>
            <Input value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} placeholder="Optional…" />
          </div>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? 'Signing in…' : 'Sign In Driver'}
          </Button>
        </form>

        {/* Today's sign-in list */}
        <div className="xl:col-span-3 space-y-3">
          <h2 className="font-semibold text-foreground text-sm">Today's Sign-Ins ({shifts.length})</h2>
          {shifts.length === 0 ? (
            <p className="text-muted-foreground text-sm">No sign-ins yet today.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-muted-foreground text-xs uppercase">
                    <th className="px-3 py-2 text-left">Driver</th>
                    <th className="px-3 py-2 text-left">Bus</th>
                    <th className="px-3 py-2 text-left">Tablet</th>
                    <th className="px-3 py-2 text-left">Start</th>
                    <th className="px-3 py-2 text-left">End</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shifts.map(s => (
                    <tr key={s.id} className="hover:bg-accent/40">
                      <td className="px-3 py-2 text-foreground whitespace-nowrap">{s.employee?.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{s.bus ? `#${s.bus.bus_number}` : '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{s.tablet?.tablet_number ?? '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{s.scheduled_start ?? '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{s.scheduled_end ?? '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Badge
                          variant={
                            s.status === 'active'    ? 'ok' :
                            s.status === 'completed' ? 'neutral' :
                            s.status === 'cancelled' ? 'danger' :
                            'info'
                          }
                          className="rounded"
                        >{s.status}</Badge>
                        {s.lunch_waiver && <span className="ml-1 text-[10px] text-warn">LW</span>}
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
const LBL = 'block text-xs text-muted-foreground mb-1'
const SEL = 'w-full h-10 bg-card border border-input text-foreground rounded-lg px-3 py-2 text-sm'

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
