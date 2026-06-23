'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Satellite, SatelliteDish, TriangleAlert } from 'lucide-react'
import { radioCodeAction } from './actions'
import { useDebouncedRefresh } from '@/lib/use-debounced-refresh'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DRIVER_PRIMARY } from '@/lib/navigation'
import { cn } from '@/lib/utils'

interface Break {
  id: string
  break_number: 1 | 2
  status: string
  scheduled_start: string | null
  window_open: string | null
  window_close: string | null
  actual_start: string | null
  actual_end: string | null
  duration_minutes: number
}

interface Shift {
  id: string
  status: string
  scheduled_start: string | null
  scheduled_end: string | null
  actual_start: string | null
  radio_status: string | null
  bus: { id: string; bus_number: string; bus_type: string; fuel_level: number | null; status: string } | null
  tablet: { id: string; tablet_number: string } | null
  breaks: Break[]
}

interface Employee { id: string; name: string; seniority_number: number | null }
interface OtBanner { id: string; is_active: boolean; message: string | null }

// Radio codes mapped to the semantic operational ramps (tone) for consistent
// color across light & dark. Full class strings so Tailwind's JIT keeps them.
const RADIO_CODES: { code: string; label: string; tone: 'ok' | 'warn' | 'info' | 'danger' }[] = [
  { code: '10-8', label: 'In Service', tone: 'ok' },
  { code: '10-39', label: 'Break', tone: 'warn' },
  { code: '10-37', label: 'Fueling/Wash', tone: 'info' },
  { code: '10-7', label: 'Out of Service', tone: 'danger' },
]
const TONE: Record<string, string> = {
  ok: 'border-ok-border bg-ok-surface text-ok',
  warn: 'border-warn-border bg-warn-surface text-warn',
  info: 'border-info-border bg-info-surface text-info',
  danger: 'border-danger-border bg-danger-surface text-danger',
}
const TONE_RING: Record<string, string> = {
  ok: 'ring-ok', warn: 'ring-warn', info: 'ring-info', danger: 'ring-danger',
}

function useCountdown(targetMs: number | null) {
  const [remaining, setRemaining] = useState<number | null>(null)
  useEffect(() => {
    if (targetMs === null) { setRemaining(null); return }
    function update() {
      const diff = targetMs! - Date.now()
      setRemaining(diff > 0 ? Math.floor(diff / 1000) : 0)
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [targetMs])
  return remaining
}

function formatCountdown(secs: number | null) {
  if (secs === null) return null
  if (secs <= 0) return '0:00'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function DriverDashboard({ employee, shift, otBanner }: { employee: Employee | null; shift: Shift | null; otBanner?: OtBanner | null }) {
  const router = useRouter()
  const debouncedRefresh = useDebouncedRefresh()
  const [currentShift, setCurrentShift] = useState<Shift | null>(shift)
  const [isPending, startTransition] = useTransition()
  const [radioCode, setRadioCode] = useState(shift?.radio_status ?? '')
  const [gpsStatus, setGpsStatus] = useState<'off' | 'active' | 'error'>('off')
  const [gpsError, setGpsError] = useState<string | null>(null)
  const lastPositionRef = { lat: 0, lng: 0, ts: 0 }

  // GPS tracking — writes bus_positions when shift is active
  useEffect(() => {
    if (!currentShift || currentShift.status !== 'active') {
      setGpsStatus('off')
      return
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('error')
      setGpsError('Geolocation not supported by this device')
      return
    }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Throttle to one write per 10 seconds
    const MIN_INTERVAL_MS = 10_000

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now()
        if (now - lastPositionRef.ts < MIN_INTERVAL_MS) return
        lastPositionRef.ts = now
        lastPositionRef.lat = pos.coords.latitude
        lastPositionRef.lng = pos.coords.longitude

        setGpsStatus('active')
        setGpsError(null)

        await supabase.from('bus_positions').insert({
          driver_id:  employee?.id ?? null,
          bus_id:     currentShift.bus?.id ?? null,
          shift_id:   currentShift.id,
          latitude:   pos.coords.latitude,
          longitude:  pos.coords.longitude,
          speed:      pos.coords.speed != null ? pos.coords.speed * 3.6 : null, // m/s → km/h
          heading:    pos.coords.heading,
          accuracy:   pos.coords.accuracy,
          recorded_at: new Date().toISOString(),
        })
      },
      (err) => {
        setGpsStatus('error')
        setGpsError(err.message)
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShift?.id, currentShift?.status])

  // Real-time breaks updates
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const ch = supabase
      .channel('driver-breaks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'breaks', filter: `shift_id=eq.${currentShift?.id ?? ''}` }, debouncedRefresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shifts' }, payload => {
        if (payload.new.id === currentShift?.id) {
          setCurrentShift(prev => prev ? { ...prev, ...payload.new } : prev)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [debouncedRefresh, currentShift?.id])

  const b1 = currentShift?.breaks.find(b => b.break_number === 1) ?? null
  const b2 = currentShift?.breaks.find(b => b.break_number === 2) ?? null
  const activeBreak = currentShift?.breaks.find(b => b.status === 'active') ?? null

  // Countdown for active break (time remaining in break)
  const breakEndTarget = activeBreak?.actual_start
    ? new Date(activeBreak.actual_start).getTime() + activeBreak.duration_minutes * 60_000
    : null
  const breakCountdown = useCountdown(breakEndTarget)

  function sendRadio(code: string) {
    if (!currentShift) return
    setRadioCode(code)
    startTransition(async () => {
      await radioCodeAction(
        currentShift.id,
        currentShift.bus?.id ?? null,
        currentShift.bus?.bus_number ?? null,
        code,
        employee ? employee.name : 'Unknown Driver'
      )
    })
  }

  async function handleBreakAction(brk: Break) {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    if (brk.status === 'pending') {
      await supabase.from('breaks').update({
        actual_start: new Date().toISOString(),
        status: 'active',
      }).eq('id', brk.id)
      sendRadio('10-39')
    } else if (brk.status === 'active') {
      await supabase.from('breaks').update({
        actual_end: new Date().toISOString(),
        status: 'completed',
      }).eq('id', brk.id)
      sendRadio('10-8')
    }
    router.refresh()
  }

  if (!employee) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">No employee profile found for your account.</p>
        <p className="mt-2 text-sm text-muted-foreground/70">Contact your supervisor.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Hello, {employee.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* OT Banner */}
      {otBanner?.is_active && otBanner.message && (
        <Card className="border-warn-border bg-warn-surface p-4">
          <p className="text-sm font-medium text-warn">{otBanner.message}</p>
        </Card>
      )}

      {/* GPS status indicators */}
      {gpsStatus === 'error' && (
        <div className="flex items-center gap-2 rounded-xl border border-danger-border bg-danger-surface px-3 py-2.5 text-danger">
          <TriangleAlert className="size-4 shrink-0" />
          <span className="text-sm font-medium">GPS unavailable — contact dispatch</span>
          {gpsError && <span className="ml-auto truncate text-xs opacity-70">{gpsError}</span>}
        </div>
      )}
      {gpsStatus === 'active' && (
        <div className="flex items-center gap-2 rounded-xl border border-ok-border bg-ok-surface px-3 py-2 text-ok">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-2 animate-ping rounded-full bg-ok opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-ok" />
          </span>
          <SatelliteDish className="size-4" />
          <span className="text-xs font-medium">GPS tracking active</span>
        </div>
      )}

      {/* No shift card */}
      {!currentShift && (
        <Card className="flex flex-col items-center gap-1 p-8 text-center">
          <Satellite className="mb-1 size-7 text-muted-foreground/60" />
          <p className="font-medium text-foreground">No active shift today</p>
          <p className="text-sm text-muted-foreground">See your dispatcher to be signed in.</p>
        </Card>
      )}

      {/* Active shift cards */}
      {currentShift && (
        <>
          {/* Break timer — prominent */}
          {activeBreak && (
            <Card className="border-warn-border bg-warn-surface p-5 text-center">
              <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-warn">
                Break {activeBreak.break_number} — In Progress
              </p>
              <div className="font-mono text-6xl font-bold tabular-nums text-warn">
                {formatCountdown(breakCountdown)}
              </div>
              <p className="mt-1 text-xs text-warn/80">
                {activeBreak.duration_minutes} minute break
                {breakCountdown !== null && breakCountdown <= 0 && (
                  <span className="ml-2 font-semibold text-danger">⚠ OVERRUN</span>
                )}
              </p>
              <Button onClick={() => handleBreakAction(activeBreak)} size="lg" className="mt-4 w-full sm:w-auto sm:px-10">
                End Break
              </Button>
            </Card>
          )}

          {/* Bus + shift times */}
          <div className="grid gap-4 sm:grid-cols-2">
            {currentShift.bus && (
              <Card className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Assigned Bus</p>
                    <p className="mt-0.5 text-3xl font-bold text-foreground">#{currentShift.bus.bus_number}</p>
                    {currentShift.tablet && (
                      <p className="mt-1 text-sm text-muted-foreground">Tablet {currentShift.tablet.tablet_number}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge variant={currentShift.bus.bus_type === 'EV' ? 'info' : 'neutral'}>
                      {currentShift.bus.bus_type}
                    </Badge>
                    {currentShift.bus.fuel_level != null && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground">{currentShift.bus.bus_type === 'EV' ? 'Charge' : 'Fuel'}</p>
                        <p className="text-lg font-bold text-foreground">{currentShift.bus.fuel_level.toFixed(0)}%</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            <Card className="grid grid-cols-2 gap-4 p-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Scheduled Start</p>
                <p className="font-medium text-foreground">{currentShift.scheduled_start ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Scheduled End</p>
                <p className="font-medium text-foreground">{currentShift.scheduled_end ?? '—'}</p>
              </div>
            </Card>
          </div>

          {/* Break buttons (when not actively on break) */}
          {!activeBreak && (
            <div className="grid grid-cols-2 gap-3">
              {[b1, b2].map((brk, i) => {
                if (!brk) return (
                  <Card key={i} className="p-4 text-center opacity-50">
                    <p className="text-xs text-muted-foreground">Break {i + 1}</p>
                    <p className="text-sm text-muted-foreground">Not scheduled</p>
                  </Card>
                )
                const now          = new Date()
                const windowClosed = brk.window_close ? now > new Date(brk.window_close) : false
                const windowOpen   = brk.window_open  ? now >= new Date(brk.window_open) : true
                const canStart     = brk.status === 'pending' && windowOpen && !windowClosed
                const windowMissed = brk.status === 'pending' && windowClosed
                const isDone       = ['completed','missed'].includes(brk.status) || windowMissed
                return (
                  <Card key={brk.id} className={cn(
                    'p-4 text-center',
                    isDone ? 'opacity-60' : canStart ? 'border-info-border bg-info-surface' : ''
                  )}>
                    <p className="text-xs text-muted-foreground">Break {brk.break_number}</p>
                    <p className="mt-0.5 text-sm font-semibold capitalize text-foreground">
                      {windowMissed ? 'missed' : brk.status}
                    </p>
                    {brk.window_open && !isDone && !canStart && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Opens {new Date(brk.window_open).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {canStart && (
                      <Button
                        onClick={() => handleBreakAction(brk)}
                        disabled={isPending}
                        size="sm"
                        className="mt-2 w-full"
                      >
                        Start Break
                      </Button>
                    )}
                  </Card>
                )
              })}
            </div>
          )}

          {/* Radio codes */}
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Radio Code</p>
            <div className="grid grid-cols-2 gap-2">
              {RADIO_CODES.map(rc => {
                const selected = radioCode === rc.code
                return (
                  <button
                    key={rc.code}
                    onClick={() => sendRadio(rc.code)}
                    disabled={isPending}
                    className={cn(
                      'rounded-xl border px-3 py-3 text-sm font-semibold transition disabled:opacity-60',
                      TONE[rc.tone],
                      selected && cn('font-bold ring-2 ring-offset-2 ring-offset-background', TONE_RING[rc.tone])
                    )}
                  >
                    {rc.code} — {rc.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Quick-launch tiles */}
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">My Shift</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {DRIVER_PRIMARY.map(item => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center transition-colors',
                      item.alert
                        ? 'border-danger-border bg-danger-surface text-danger hover:border-danger'
                        : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent'
                    )}
                  >
                    <Icon className="size-6" />
                    <span className="text-xs font-medium leading-tight">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
