'use client'

/**
 * DriverShell — wraps the entire driver UI.
 * Handles:
 *   1. Motion safety lock (devicemotion API)
 *   2. Offline detection + IndexedDB sync banner
 *   3. Emergency alert modal (Realtime subscription)
 *
 * Mounted from app/driver/layout.tsx as a client boundary.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

// ─── Constants ───────────────────────────────────────────────────────────────
const MOTION_SPEED_MPH_THRESHOLD = 5       // lock activates above this speed
const MOTION_LOCK_SECONDS        = 8       // must be moving for this long
const MOTION_UNLOCK_SECONDS      = 15      // must be stationary for this long
const MS_PER_KMH                 = 0.277778
const MPH_TO_MS                  = 0.44704

// ─── Types ───────────────────────────────────────────────────────────────────
interface EmergencyEvent {
  id:         string
  event_type: string
  message:    string
  triggered_at: string
}

// ─── Military clock display (for motion lock screen) ─────────────────────────
function MilitaryClock() {
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')
  useEffect(() => {
    function update() {
      const now = new Date()
      const hh  = String(now.getHours()).padStart(2, '0')
      const mm  = String(now.getMinutes()).padStart(2, '0')
      const ss  = String(now.getSeconds()).padStart(2, '0')
      setTime(`${hh}${mm}`)
      setDate(now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase())
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white select-none">
      <div className="text-[22vw] font-mono font-bold leading-none tabular-nums tracking-tight">
        {time}
      </div>
      <div className="text-[3vw] font-mono mt-4 text-gray-400 tracking-widest">
        {date}
      </div>
      <div className="mt-8 text-gray-600 text-sm">Keep your eyes on the road</div>
    </div>
  )
}

// ─── Emergency modal ─────────────────────────────────────────────────────────
function EmergencyAlertModal({
  event,
  employeeId,
  onAcknowledged,
}: {
  event: EmergencyEvent
  employeeId: string
  onAcknowledged: () => void
}) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const [submitting, setSubmitting] = useState(false)

  const typeLabel: Record<string, string> = {
    weather:           'WEATHER ALERT',
    airport_emergency: 'AIRPORT EMERGENCY',
    reroute:           'SHUTTLE REROUTING NOTICE',
    custom:            'EMERGENCY NOTICE',
  }

  async function acknowledge() {
    setSubmitting(true)
    await supabase.from('emergency_acknowledgements').insert({
      event_id:    event.id,
      employee_id: employeeId,
    })
    onAcknowledged()
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-red-950/95 flex items-center justify-center p-6">
      <div className="bg-red-900 border-2 border-red-500 rounded-2xl max-w-lg w-full p-8 text-center">
        <div className="text-red-300 text-sm font-bold uppercase tracking-widest mb-2">
          {typeLabel[event.event_type] ?? 'EMERGENCY'}
        </div>
        <div className="w-12 h-12 bg-red-500 rounded-full mx-auto mb-4 flex items-center justify-center">
          <span className="text-white text-2xl font-bold">!</span>
        </div>
        <h2 className="text-white text-2xl font-bold mb-4">Emergency Alert</h2>
        <p className="text-red-100 text-lg leading-relaxed mb-8 whitespace-pre-wrap">{event.message}</p>
        <button
          onClick={acknowledge}
          disabled={submitting}
          className="w-full bg-white text-red-900 font-bold text-xl py-4 rounded-xl hover:bg-red-100 disabled:opacity-60 transition-colors"
        >
          {submitting ? 'Logging acknowledgement…' : 'I Acknowledge'}
        </button>
        <p className="text-red-400 text-xs mt-4">
          This alert cannot be dismissed without acknowledging.
        </p>
      </div>
    </div>
  )
}

// ─── Main shell ──────────────────────────────────────────────────────────────
export default function DriverShell({
  children,
  employeeId,
  isMotionLockExempt = false,
}: {
  children: React.ReactNode
  employeeId: string
  isMotionLockExempt?: boolean
}) {
  const [locked, setLocked]               = useState(false)
  const [isOnline, setIsOnline]           = useState(true)
  const [syncStatus, setSyncStatus]       = useState<'idle' | 'syncing' | 'done'>('idle')
  const [emergency, setEmergency]         = useState<EmergencyEvent | null>(null)
  const [acknowledged, setAcknowledged]   = useState<Set<string>>(new Set())

  const movingFor    = useRef(0)  // seconds continuously above threshold
  const stationaryFor = useRef(0) // seconds continuously below threshold
  const lastMotionTs  = useRef(0)

  // ── Motion lock (GPS-speed driven) ───────────────────────────────────────────
  // Uses real vehicle speed from the Geolocation API (m/s → mph) rather than the
  // old accelerometer-magnitude proxy (which compared an m/s² value to an m/s
  // threshold — a category error that mis-fired). coords.speed is null on devices
  // without GPS speed, which safely reads as 0 (no false lock).
  useEffect(() => {
    if (isMotionLockExempt || typeof navigator === 'undefined' || !navigator.geolocation) return

    let lastTs = Date.now()
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now()
        const deltaS = Math.min((now - lastTs) / 1000, 5) // cap gaps so a long pause can't insta-toggle
        lastTs = now

        const mph = pos.coords.speed != null && pos.coords.speed >= 0
          ? pos.coords.speed * 2.23694
          : 0
        const moving = mph > MOTION_SPEED_MPH_THRESHOLD

        if (moving) { movingFor.current += deltaS; stationaryFor.current = 0 }
        else        { stationaryFor.current += deltaS; movingFor.current = 0 }

        setLocked(prev => {
          if (!prev && movingFor.current >= MOTION_LOCK_SECONDS)        { movingFor.current = 0;    return true }
          if (prev  && stationaryFor.current >= MOTION_UNLOCK_SECONDS)  { stationaryFor.current = 0; return false }
          return prev
        })
      },
      () => { /* geolocation error → leave unlocked (fail-safe) */ },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [isMotionLockExempt])

  // ── Online / offline ───────────────────────────────────────────────────────
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const goOnline  = () => { setIsOnline(true);  triggerSync() }
    const goOffline = () => { setIsOnline(false); setSyncStatus('idle') }
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const triggerSync = useCallback(async () => {
    setSyncStatus('syncing')
    // Ping supabase to confirm connectivity
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      await supabase.from('employees').select('id').limit(1)
    } catch {
      setSyncStatus('idle')
      return
    }

    // Process each IndexedDB queue in order (dynamic import to avoid SSR issues)
    const { getAllQueued, deleteQueued } = await import('@/lib/indexed-db')
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // 1. Status changes — only drop from the queue once the write SUCCEEDS.
    // (Supabase returns errors in `{ error }` rather than throwing, so an
    // unchecked update used to delete the queued edit even when it failed.)
    const statusChanges = await getAllQueued('pending_status_changes')
    for (const item of statusChanges) {
      const d = item.data as { shift_id: string; radio_status: string }
      const { error } = await supabase.from('shifts').update({ radio_status: d.radio_status }).eq('id', d.shift_id)
      if (error) continue // keep queued, retry next sync
      await deleteQueued('pending_status_changes', item.key)
    }

    // 2. Breaks — same: keep queued on error so the edit is not lost.
    const breaks = await getAllQueued('pending_breaks')
    for (const item of breaks) {
      const d = item.data as { break_id: string; actual_start?: string; actual_end?: string; status: string }
      const { error } = await supabase.from('breaks').update({
        ...(d.actual_start ? { actual_start: d.actual_start } : {}),
        ...(d.actual_end   ? { actual_end:   d.actual_end   } : {}),
        status: d.status,
      }).eq('id', d.break_id)
      if (error) continue // keep queued, retry next sync
      await deleteQueued('pending_breaks', item.key)
    }

    // 3. Counting sheets (header + rows) → real tables counting_sheets / counting_rows
    const countingSheets = await getAllQueued('pending_counting_sheet_rows')
    for (const item of countingSheets) {
      const d = item.data as { sheet: Record<string, unknown>; rows: Record<string, unknown>[] }
      if (!d?.sheet) { await deleteQueued('pending_counting_sheet_rows', item.key); continue }
      const { data: created, error } = await supabase
        .from('counting_sheets').insert(d.sheet).select('id').single()
      if (error || !created) continue // keep queued, retry next sync
      if (d.rows?.length) {
        const { error: rowsErr } = await supabase
          .from('counting_rows')
          .insert(d.rows.map(r => ({ ...r, sheet_id: created.id })))
        if (rowsErr) continue
      }
      await deleteQueued('pending_counting_sheet_rows', item.key)
    }

    // 4. Inspections (header + items) → vehicle_inspections / inspection_items
    const inspections = await getAllQueued('pending_inspections')
    for (const item of inspections) {
      const d = item.data as { inspection: Record<string, unknown>; items: Record<string, unknown>[] }
      if (!d?.inspection) { await deleteQueued('pending_inspections', item.key); continue }
      const { data: created, error } = await supabase
        .from('vehicle_inspections').insert(d.inspection).select('id').single()
      if (error || !created) continue
      if (d.items?.length) {
        const { error: itemsErr } = await supabase
          .from('inspection_items')
          .insert(d.items.map(it => ({ ...it, inspection_id: created.id })))
        if (itemsErr) continue
      }
      await deleteQueued('pending_inspections', item.key)
    }

    setSyncStatus('done')
    setTimeout(() => setSyncStatus('idle'), 5000)
  }, [])

  // ── Emergency Realtime subscription ───────────────────────────────────────
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Check for currently active emergency on mount
    supabase.from('emergency_events')
      .select('id, event_type, message, triggered_at')
      .eq('is_active', true)
      .single()
      .then(({ data }) => {
        if (data && !acknowledged.has(data.id)) setEmergency(data)
      })

    const ch = supabase
      .channel('emergency-events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'emergency_events' },
        (payload) => {
          const ev = payload.new as EmergencyEvent & { is_active: boolean }
          if (ev.is_active && !acknowledged.has(ev.id)) setEmergency(ev)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'emergency_events' },
        (payload) => {
          const ev = payload.new as EmergencyEvent & { is_active: boolean }
          if (!ev.is_active) setEmergency(null)  // emergency resolved
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onEmergencyAcknowledged() {
    if (emergency) {
      setAcknowledged(prev => new Set([...prev, emergency.id]))
      setEmergency(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Offline banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-900 text-white text-center text-sm font-semibold py-2">
          NO CONNECTION — Data is being saved locally
        </div>
      )}
      {isOnline && syncStatus === 'syncing' && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-blue-800 text-white text-center text-sm font-semibold py-2">
          RECONNECTED — Syncing...
        </div>
      )}
      {isOnline && syncStatus === 'done' && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-green-800 text-white text-center text-sm font-semibold py-2">
          ✓ Sync complete
        </div>
      )}

      {/* Motion lock overlay — emergency modal can appear on top of it */}
      {locked && !isMotionLockExempt ? (
        <>
          <MilitaryClock />
          {/* Emergency modal appears over the motion lock screen */}
          {emergency && (
            <EmergencyAlertModal
              event={emergency}
              employeeId={employeeId}
              onAcknowledged={onEmergencyAcknowledged}
            />
          )}
        </>
      ) : (
        <>
          <div className={!isOnline || syncStatus !== 'idle' ? 'mt-9' : ''}>
            {children}
          </div>
          {/* Emergency modal always on top */}
          {emergency && (
            <EmergencyAlertModal
              event={emergency}
              employeeId={employeeId}
              onAcknowledged={onEmergencyAcknowledged}
            />
          )}
        </>
      )}
    </>
  )
}
