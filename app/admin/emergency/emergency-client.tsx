'use client'

import { useState, useEffect, useTransition } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { triggerEmergencyAction, resolveEmergencyAction, getEmergencyAckStatusAction } from './actions'

type EventType = 'weather' | 'airport_emergency' | 'reroute' | 'custom'

interface AckStatus {
  acknowledged:   { employeeId: string; name: string; acknowledgedAt: string }[]
  unacknowledged: { id: string; name: string }[]
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
      if ('error' in res) { setError(res.error ?? 'Failed to trigger emergency'); return }
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
        <div className="rounded-2xl border-2 border-danger bg-danger-surface p-5 sm:p-6">
          <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-3 shrink-0 rounded-full bg-danger animate-pulse" />
              <span className="text-danger font-bold text-lg uppercase tracking-wide">
                Emergency Active — {TYPE_LABELS[activeEvent.event_type as EventType] ?? activeEvent.event_type}
              </span>
            </div>
            <span className="text-muted-foreground text-xs shrink-0">
              {new Date(activeEvent.triggered_at).toLocaleString('en-US', { hour12: false })}
            </span>
          </div>
          <p className="text-foreground text-base mb-6 whitespace-pre-wrap">{activeEvent.message}</p>

          {ackStatus && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl border border-ok-border bg-ok-surface p-4">
                <div className="text-ok font-bold text-2xl">{ackStatus.acknowledged.length}</div>
                <div className="text-ok text-sm">Acknowledged</div>
              </div>
              <div className="rounded-xl border border-warn-border bg-warn-surface p-4">
                <div className="text-warn font-bold text-2xl">{ackStatus.unacknowledged.length}</div>
                <div className="text-warn text-sm">Not yet acknowledged</div>
              </div>
            </div>
          )}

          {ackStatus?.unacknowledged && ackStatus.unacknowledged.length > 0 && (
            <details className="mb-4">
              <summary className="text-warn text-sm hover:text-warn/80">
                View unacknowledged employees ({ackStatus.unacknowledged.length})
              </summary>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                {ackStatus.unacknowledged.map(e => (
                  <div key={e.id} className="text-muted-foreground text-xs px-2 py-1 bg-card rounded">
                    {e.name}
                  </div>
                ))}
              </div>
            </details>
          )}

          {!confirmResolve ? (
            <Button onClick={() => setConfirmResolve(true)} variant="success" size="lg">
              Resolve Emergency
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-foreground text-sm">Confirm resolve emergency?</span>
              <Button onClick={handleResolve} disabled={isPending} variant="success">
                Yes, Resolve
              </Button>
              <Button onClick={() => setConfirmResolve(false)} variant="ghost">
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Trigger form */}
      {!activeEvent && (
        <Card>
          <CardContent className="p-5 sm:p-6">
            <h2 className="text-foreground font-semibold text-lg mb-5">Trigger Emergency Alert</h2>

            <div className="space-y-4">
              <div>
                <Label className="mb-2 block text-muted-foreground">Event Type</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Object.entries(TYPE_LABELS) as [EventType, string][]).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setEventType(val)}
                      className={`py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors ${
                        eventType === val
                          ? 'border-danger bg-danger text-white'
                          : 'border-border bg-muted text-muted-foreground hover:border-danger-border hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-1 block text-muted-foreground">Message</Label>
                <Textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Describe the emergency situation and required actions…"
                  className="resize-none"
                />
              </div>

              {error && <p className="text-danger text-sm">{error}</p>}

              <Button
                onClick={handleTrigger}
                disabled={isPending || !message.trim()}
                variant="destructive"
                size="lg"
                className="w-full text-lg"
              >
                <AlertTriangle className="size-5" />
                {isPending ? 'Activating…' : 'Trigger Emergency Alert'}
              </Button>
              <p className="text-muted-foreground text-xs text-center">
                All drivers, dispatchers, and supervisors will see a full-screen alert immediately.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
