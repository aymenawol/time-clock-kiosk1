'use client'

import { useState, useEffect, useTransition } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { triggerEmergencyAction, resolveEmergencyAction, getEmergencyAckStatusAction } from './actions'

type EventType = 'weather' | 'airport_emergency' | 'reroute' | 'custom'

interface AckStatus {
  acknowledged:   { employeeId: string; name: string; acknowledgedAt: string }[]
  unacknowledged: { id: string; full_name: string }[]
}

interface ActiveEvent {
  id: string
  event_type: string
  message: string
  triggered_at: string
}

interface Props {
  initialActiveEvent: ActiveEvent | null
}

const TYPE_LABELS: Record<EventType, string> = {
  weather:           'Weather Alert',
  airport_emergency: 'Airport Emergency',
  reroute:           'Shuttle Rerouting',
  custom:            'Custom Alert',
}

export default function EmergencyClient({ initialActiveEvent }: Props) {
  const [activeEvent, setActiveEvent]   = useState<ActiveEvent | null>(initialActiveEvent)
  const [eventType, setEventType]       = useState<EventType>('custom')
  const [message, setMessage]           = useState('')
  const [ackStatus, setAckStatus]       = useState<AckStatus | null>(null)
  const [isPending, startTransition]    = useTransition()
  const [error, setError]               = useState<string | null>(null)
  const [confirmResolve, setConfirmResolve] = useState(false)

  // Poll ack status every 10 seconds while active
  useEffect(() => {
    if (!activeEvent) { setAckStatus(null); return }
    let mounted = true

    async function refresh() {
      if (!activeEvent) return
      const result = await getEmergencyAckStatusAction(activeEvent.id)
      if (mounted) setAckStatus(result)
    }

    refresh()
    const t = setInterval(refresh, 10_000)
    return () => { mounted = false; clearInterval(t) }
  }, [activeEvent])

  // Realtime subscription for emergency events
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const ch = supabase
      .channel('admin-emergency-events')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emergency_events' }, payload => {
        const ev = payload.new as ActiveEvent & { is_active: boolean }
        if (ev.is_active) setActiveEvent(ev)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'emergency_events' }, payload => {
        const ev = payload.new as ActiveEvent & { is_active: boolean }
        if (!ev.is_active && activeEvent?.id === ev.id) setActiveEvent(null)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleTrigger() {
    if (!message.trim()) return
    setError(null)
    startTransition(async () => {
      const res = await triggerEmergencyAction(eventType, message)
      if ('error' in res) { setError(res.error); return }
    })
  }

  function handleResolve() {
    if (!activeEvent) return
    setConfirmResolve(false)
    startTransition(async () => {
      const res = await resolveEmergencyAction(activeEvent.id)
      if ('error' in res && res.error) { setError(res.error); return }
      setActiveEvent(null)
    })
  }

  return (
    <div className="space-y-8">
      {/* Active emergency status */}
      {activeEvent && (
        <div className="bg-red-950/70 border-2 border-red-600 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-300 font-bold text-lg uppercase tracking-wide">
                Emergency Active — {TYPE_LABELS[activeEvent.event_type as EventType] ?? activeEvent.event_type}
              </span>
            </div>
            <span className="text-gray-500 text-xs">
              {new Date(activeEvent.triggered_at).toLocaleString('en-US', { hour12: false })}
            </span>
          </div>
          <p className="text-white text-base mb-6 whitespace-pre-wrap">{activeEvent.message}</p>

          {ackStatus && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-green-950/50 border border-green-800 rounded-xl p-4">
                <div className="text-green-400 font-bold text-2xl">{ackStatus.acknowledged.length}</div>
                <div className="text-green-300 text-sm">Acknowledged</div>
              </div>
              <div className="bg-yellow-950/50 border border-yellow-800 rounded-xl p-4">
                <div className="text-yellow-400 font-bold text-2xl">{ackStatus.unacknowledged.length}</div>
                <div className="text-yellow-300 text-sm">Not yet acknowledged</div>
              </div>
            </div>
          )}

          {ackStatus?.unacknowledged && ackStatus.unacknowledged.length > 0 && (
            <details className="mb-4">
              <summary className="text-yellow-400 text-sm cursor-pointer hover:text-yellow-300">
                View unacknowledged employees ({ackStatus.unacknowledged.length})
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                {ackStatus.unacknowledged.map(e => (
                  <div key={e.id} className="text-gray-400 text-xs px-2 py-1 bg-gray-900 rounded">
                    {e.full_name}
                  </div>
                ))}
              </div>
            </details>
          )}

          {!confirmResolve ? (
            <button
              onClick={() => setConfirmResolve(true)}
              className="bg-green-700 hover:bg-green-600 text-white font-bold px-6 py-3 rounded-xl transition-colors"
            >
              Resolve Emergency
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-gray-300 text-sm">Confirm resolve emergency?</span>
              <button
                onClick={handleResolve}
                disabled={isPending}
                className="bg-green-700 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-xl text-sm"
              >
                Yes, Resolve
              </button>
              <button
                onClick={() => setConfirmResolve(false)}
                className="text-gray-500 hover:text-gray-300 text-sm"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Trigger form */}
      {!activeEvent && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold text-lg mb-5">Trigger Emergency Alert</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Event Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(TYPE_LABELS) as [EventType, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setEventType(val)}
                    className={`py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors ${
                      eventType === val
                        ? 'bg-red-800 border-red-600 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Message</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                placeholder="Describe the emergency situation and required actions…"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-red-700 resize-none"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={handleTrigger}
              disabled={isPending || !message.trim()}
              className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-4 rounded-xl text-lg disabled:opacity-40 transition-colors"
            >
              {isPending ? 'Activating…' : '⚠ Trigger Emergency Alert'}
            </button>
            <p className="text-gray-600 text-xs text-center">
              All drivers, dispatchers, and supervisors will see a full-screen alert immediately.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
