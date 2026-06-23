'use client'

import { useState, useEffect, useTransition } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Accessibility, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface WheelchairRequest {
  id:             string
  passenger_name: string
  flight_number:  string
  submitted_at:   string
  status:         string
  driver_name:    string
  bus_number:     string
  airline_name:   string
}

export default function WheelchairAlertsPanel() {
  const [requests, setRequests]       = useState<WheelchairRequest[]>([])
  const [responding, setResponding]   = useState<string | null>(null)
  const [responseText, setResponseText] = useState('')
  const [isPending, startTransition]  = useTransition()

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Load active requests
    supabase.from('wheelchair_requests')
      .select(`
        id, passenger_name, flight_number, submitted_at, status,
        employees!driver_id(name),
        buses!bus_id(bus_number),
        airlines!airline_id(name)
      `)
      .in('status', ['pending', 'acknowledged', 'escalated'])
      .order('submitted_at', { ascending: false })
      .then(({ data }) => {
        type RawReq = {
          id: string
          passenger_name: string
          flight_number: string
          submitted_at: string
          status: string
          employees: { name: string } | null
          buses: { bus_number: string } | null
          airlines: { name: string } | null
        }
        setRequests(((data ?? []) as unknown as RawReq[]).map((r) => ({
          id:             r.id,
          passenger_name: r.passenger_name,
          flight_number:  r.flight_number,
          submitted_at:   r.submitted_at,
          status:         r.status,
          driver_name:    r.employees?.name ?? 'Unknown',
          bus_number:     r.buses?.bus_number ?? 'N/A',
          airline_name:   r.airlines?.name ?? 'Unknown',
        })))
      })

    // Realtime updates
    const ch = supabase
      .channel('dispatcher-wheelchair')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wheelchair_requests' }, payload => {
        const r = payload.new as {
          id: string; passenger_name: string; flight_number: string; submitted_at: string; status: string
        }
        setRequests(prev => [{
          id:             r.id,
          passenger_name: r.passenger_name,
          flight_number:  r.flight_number,
          submitted_at:   r.submitted_at,
          status:         r.status,
          driver_name:    'Loading…',
          bus_number:     '…',
          airline_name:   '…',
        }, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wheelchair_requests' }, payload => {
        const u = payload.new as { id: string; status: string; dispatcher_response: string | null }
        setRequests(prev => {
          if (['resolved', 'closed'].includes(u.status)) {
            return prev.filter(r => r.id !== u.id)
          }
          return prev.map(r => r.id === u.id ? { ...r, status: u.status } : r)
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [])

  function handleRespond(id: string) {
    if (!responseText.trim()) return
    startTransition(async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      await supabase.from('wheelchair_requests').update({
        status:              'acknowledged',
        dispatcher_response: responseText.trim(),
        responded_at:        new Date().toISOString(),
      }).eq('id', id)
      setResponding(null)
      setResponseText('')
    })
  }

  function handleResolve(id: string) {
    startTransition(async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      await supabase.from('wheelchair_requests').update({ status: 'resolved' }).eq('id', id)
    })
  }

  if (requests.length === 0) return null

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-warn opacity-75 animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-warn" />
        </span>
        <h2 className="text-warn font-bold text-sm uppercase tracking-wide flex items-center gap-1.5">
          <Accessibility className="size-4" aria-hidden />
          10-51 Wheelchair Requests ({requests.length})
        </h2>
      </div>
      <div className="space-y-2">
        {requests.map(r => (
          <div key={r.id} className={`border rounded-xl p-4 ${
            r.status === 'escalated' ? 'bg-danger-surface border-danger-border' :
            r.status === 'acknowledged' ? 'bg-info-surface border-info-border' :
            'bg-warn-surface border-warn-border'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-foreground font-medium text-sm">{r.passenger_name}</div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  {r.airline_name} · Flight {r.flight_number} · Bus {r.bus_number}
                </div>
                <div className="text-muted-foreground text-xs">Driver: {r.driver_name}</div>
                <div className="text-muted-foreground text-xs">
                  {new Date(r.submitted_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <Badge
                  variant={
                    r.status === 'escalated'   ? 'danger'  :
                    r.status === 'acknowledged' ? 'info' :
                    'warn'
                  }
                  className="justify-center"
                >
                  {r.status}
                </Badge>
                {r.status !== 'resolved' && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => { setResponding(r.id); setResponseText('') }}
                    >
                      Respond
                    </Button>
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => handleResolve(r.id)}
                      disabled={isPending}
                    >
                      Resolve
                    </Button>
                  </>
                )}
              </div>
            </div>

            {responding === r.id && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Input
                  value={responseText}
                  onChange={e => setResponseText(e.target.value)}
                  placeholder="Type your response to the driver…"
                  className="flex-1 min-w-0"
                />
                <Button
                  onClick={() => handleRespond(r.id)}
                  disabled={isPending || !responseText.trim()}
                >
                  Send
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setResponding(null)} aria-label="Cancel">
                  <X aria-hidden />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
