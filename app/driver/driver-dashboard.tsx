'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

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

interface Employee { id: string; first_name: string; last_name: string; seniority_number: number | null }
interface OtBanner { id: string; is_active: boolean; message: string | null }

const RADIO_CODES = [
  { code: '10-8',  label: 'In Service',     color: 'bg-green-700 hover:bg-green-600 border-green-600' },
  { code: '10-39', label: 'Break',           color: 'bg-yellow-700 hover:bg-yellow-600 border-yellow-600' },
  { code: '10-37', label: 'Fueling/Wash',    color: 'bg-blue-700 hover:bg-blue-600 border-blue-600' },
  { code: '10-7',  label: 'Out of Service',  color: 'bg-red-700 hover:bg-red-600 border-red-600' },
]

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'breaks' }, () => router.refresh())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shifts' }, payload => {
        if (payload.new.id === currentShift?.id) {
          setCurrentShift(prev => prev ? { ...prev, ...payload.new } : prev)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [router, currentShift?.id])

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
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      await supabase.from('shifts').update({ radio_status: code }).eq('id', currentShift.id)
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
      <div className="text-center py-20">
        <p className="text-gray-400">No employee profile found for your account.</p>
        <p className="text-gray-600 text-sm mt-2">Contact your supervisor.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* OT Banner */}
      {otBanner?.is_active && otBanner.message && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-4">
          <p className="text-yellow-200 text-sm font-medium">{otBanner.message}</p>
        </div>
      )}

      {/* GPS status indicators */}
      {gpsStatus === 'error' && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-3 flex items-center gap-2">
          <span className="text-red-400 text-sm font-medium">⚠ GPS unavailable — contact dispatch</span>
          {gpsError && <span className="text-red-600 text-xs ml-auto">{gpsError}</span>}
        </div>
      )}
      {gpsStatus === 'active' && (
        <div className="bg-green-900/20 border border-green-800 rounded-xl p-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 text-xs">GPS tracking active</span>
        </div>
      )}

      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Hello, {employee.first_name}!
        </h1>
        <p className="text-gray-500 text-sm">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* No shift card */}
      {!currentShift && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
          <p className="text-gray-400">No active shift today.</p>
          <p className="text-gray-600 text-sm mt-1">See your dispatcher to be signed in.</p>
        </div>
      )}

      {/* Active shift cards */}
      {currentShift && (
        <>
          {/* Break timer — prominent */}
          {activeBreak && (
            <div className="bg-yellow-950/60 border-2 border-yellow-600 rounded-xl p-5 text-center">
              <p className="text-yellow-300 text-sm font-semibold uppercase tracking-wide mb-1">
                Break {activeBreak.break_number} — In Progress
              </p>
              <div className="text-6xl font-mono font-bold text-yellow-300 tabular-nums">
                {formatCountdown(breakCountdown)}
              </div>
              <p className="text-yellow-500 text-xs mt-1">
                {activeBreak.duration_minutes} minute break
                {breakCountdown !== null && breakCountdown <= 0 && (
                  <span className="text-red-400 font-semibold ml-2">⚠ OVERRUN</span>
                )}
              </p>
              <button
                onClick={() => handleBreakAction(activeBreak)}
                className="mt-4 bg-yellow-600 hover:bg-yellow-500 text-white font-bold px-8 py-3 rounded-xl text-lg"
              >
                End Break
              </button>
            </div>
          )}

          {/* Bus card */}
          {currentShift.bus && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-xs uppercase">Assigned Bus</p>
                  <p className="text-3xl font-bold text-white mt-0.5">#{currentShift.bus.bus_number}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded font-semibold ${
                    currentShift.bus.bus_type === 'EV' ? 'bg-teal-900 text-teal-300' : 'bg-gray-800 text-gray-400'
                  }`}>{currentShift.bus.bus_type}</span>
                  {currentShift.bus.fuel_level != null && (
                    <div className="mt-2">
                      <p className="text-gray-500 text-xs">{currentShift.bus.bus_type === 'EV' ? 'Charge' : 'Fuel'}</p>
                      <p className="text-white text-lg font-bold">{currentShift.bus.fuel_level.toFixed(0)}%</p>
                    </div>
                  )}
                </div>
              </div>
              {currentShift.tablet && (
                <p className="text-gray-500 text-sm mt-2">Tablet: {currentShift.tablet.tablet_number}</p>
              )}
            </div>
          )}

          {/* Shift times */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs">Scheduled Start</p>
              <p className="text-white font-medium">{currentShift.scheduled_start ?? '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Scheduled End</p>
              <p className="text-white font-medium">{currentShift.scheduled_end ?? '—'}</p>
            </div>
          </div>

          {/* Break buttons (when not actively on break) */}
          {!activeBreak && (
            <div className="grid grid-cols-2 gap-3">
              {[b1, b2].map((brk, i) => {
                if (!brk) return (
                  <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-center opacity-40">
                    <p className="text-gray-500 text-xs">Break {i + 1}</p>
                    <p className="text-gray-600 text-sm">Not scheduled</p>
                  </div>
                )
                const canStart = brk.status === 'pending'
                const isDone   = ['completed','missed'].includes(brk.status)
                return (
                  <div key={brk.id} className={`border rounded-xl p-4 text-center ${
                    isDone ? 'border-gray-800 bg-gray-900/30 opacity-60' :
                    canStart ? 'border-blue-700 bg-blue-950/30' :
                    'border-gray-800 bg-gray-900'
                  }`}>
                    <p className="text-gray-400 text-xs">Break {brk.break_number}</p>
                    <p className="text-white font-semibold text-sm capitalize mt-0.5">{brk.status}</p>
                    {canStart && (
                      <button
                        onClick={() => handleBreakAction(brk)}
                        disabled={isPending}
                        className="mt-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg w-full"
                      >
                        Start Break
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Radio codes */}
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Radio Code</p>
            <div className="grid grid-cols-2 gap-2">
              {RADIO_CODES.map(rc => (
                <button
                  key={rc.code}
                  onClick={() => sendRadio(rc.code)}
                  disabled={isPending}
                  className={`border text-white text-sm font-semibold py-2.5 rounded-lg ${rc.color} ${
                    radioCode === rc.code ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-950' : ''
                  }`}
                >
                  {rc.code} — {rc.label}
                </button>
              ))}
            </div>
          </div>

          {/* Nav tiles */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <NavTile href="/driver/counting-sheet" label="Counting Sheet" emoji="📋" />
            <NavTile href="/driver/inspection/pre_trip"  label="Pre-Trip"      emoji="🔍" />
            <NavTile href="/driver/inspection/post_trip" label="Post-Trip"     emoji="✅" />
            <NavTile href="/driver/10-51"   label="10-51 Wheelchair" emoji="♿" highlight />
            <NavTile href="/driver/lost-found" label="Lost & Found" emoji="🔎" />
            <NavTile href="/driver/forms"   label="Forms"           emoji="📝" />
          </div>
        </>
      )}
    </div>
  )
}

function NavTile({ href, label, emoji, highlight }: { href: string; label: string; emoji: string; highlight?: boolean }) {
  return (
    <a href={href} className={`border rounded-xl p-4 text-center block transition-colors ${highlight ? 'bg-orange-950/40 border-orange-700 hover:border-orange-500' : 'bg-gray-900 border-gray-800 hover:border-gray-600'}`}>
      <div className="text-2xl mb-1">{emoji}</div>
      <div className={`text-xs ${highlight ? 'text-orange-300 font-semibold' : 'text-gray-400'}`}>{label}</div>
    </a>
  )
}
