'use client'

import { useState, useEffect, useTransition } from 'react'
import { createBrowserClient } from '@supabase/ssr'

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
        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
        <h2 className="text-orange-400 font-bold text-sm uppercase tracking-wide">
          10-51 Wheelchair Requests ({requests.length})
        </h2>
      </div>
      <div className="space-y-2">
        {requests.map(r => (
          <div key={r.id} className={`border rounded-xl p-4 ${
            r.status === 'escalated' ? 'bg-red-950/50 border-red-700' :
            r.status === 'acknowledged' ? 'bg-blue-950/50 border-blue-700' :
            'bg-orange-950/50 border-orange-700'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-foreground font-medium text-sm">{r.passenger_name}</div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  {r.airline_name} · Flight {r.flight_number} · Bus {r.bus_number}
                </div>
                <div className="text-muted-foreground text-xs">Driver: {r.driver_name}</div>
                <div className="text-gray-600 text-xs">
                  {new Date(r.submitted_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full text-center font-medium ${
                  r.status === 'escalated'   ? 'bg-red-700 text-red-200'    :
                  r.status === 'acknowledged' ? 'bg-blue-700 text-blue-200' :
                  'bg-orange-700 text-orange-200'
                }`}>
                  {r.status}
                </span>
                {r.status !== 'resolved' && (
                  <>
                    <button
                      onClick={() => { setResponding(r.id); setResponseText('') }}
                      className="text-xs bg-gray-700 hover:bg-gray-600 text-foreground px-2 py-1 rounded"
                    >
                      Respond
                    </button>
                    <button
                      onClick={() => handleResolve(r.id)}
                      disabled={isPending}
                      className="text-xs bg-green-800 hover:bg-green-700 text-foreground px-2 py-1 rounded"
                    >
                      Resolve
                    </button>
                  </>
                )}
              </div>
            </div>

            {responding === r.id && (
              <div className="mt-3 flex gap-2">
                <input
                  value={responseText}
                  onChange={e => setResponseText(e.target.value)}
                  placeholder="Type your response to the driver…"
                  className="flex-1 bg-muted border border-gray-600 rounded-lg px-3 py-2 text-foreground text-sm"
                />
                <button
                  onClick={() => handleRespond(r.id)}
                  disabled={isPending || !responseText.trim()}
                  className="bg-blue-700 hover:bg-blue-600 text-foreground text-sm px-3 py-2 rounded-lg"
                >
                  Send
                </button>
                <button onClick={() => setResponding(null)} className="text-muted-foreground hover:text-foreground text-sm px-2">
                  ×
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
