'use client'

import { useState, useEffect, useTransition } from 'react'
import { createBrowserClient } from '@supabase/ssr'

interface Airline { id: string; name: string; terminal: string; wheelchair_contact: string | null }
interface ActiveShift { id: string; bus: { id: string; bus_number: string } | null }
interface ExistingRequest { id: string; status: string; passenger_name: string }

interface Props {
  employeeId: string
  activeShift: ActiveShift | null
  airlines: Airline[]
}

export default function WheelchairForm({ employeeId, activeShift, airlines }: Props) {
  const [passengerName, setPassengerName] = useState('')
  const [airlineId, setAirlineId]         = useState('')
  const [flightNumber, setFlightNumber]   = useState('')
  const [query, setQuery]                 = useState('')
  const [submitted, setSubmitted]         = useState<string | null>(null) // request id
  const [dispatchResponse, setDispatchResponse] = useState<string | null>(null)
  const [status, setStatus]               = useState<string | null>(null)
  const [existing, setExisting]           = useState<ExistingRequest[]>([])
  const [isPending, startTransition]      = useTransition()
  const [error, setError]                 = useState<string | null>(null)

  const filteredAirlines = airlines.filter(a =>
    query === '' || a.name.toLowerCase().includes(query.toLowerCase())
  )
  const selectedAirline = airlines.find(a => a.id === airlineId)
  const busNumber = activeShift?.bus?.bus_number ?? 'N/A'

  // Pre-flight: check for open requests on this bus
  useEffect(() => {
    if (!activeShift?.bus?.id) return
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabase.from('wheelchair_requests')
      .select('id, status, passenger_name')
      .eq('bus_id', activeShift.bus.id)
      .in('status', ['pending', 'acknowledged'])
      .then(({ data }) => setExisting(data ?? []))
  }, [activeShift])

  // Poll own request for dispatcher response
  useEffect(() => {
    if (!submitted) return
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const ch = supabase
      .channel('my-wheelchair-request')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'wheelchair_requests',
        filter: `id=eq.${submitted}`,
      }, payload => {
        const updated = payload.new as { status: string; dispatcher_response: string | null }
        setStatus(updated.status)
        if (updated.dispatcher_response) setDispatchResponse(updated.dispatcher_response)
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [submitted])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!airlineId || !passengerName.trim() || !flightNumber.trim()) return
    if (!activeShift?.bus?.id) { setError('No active shift or bus assigned'); return }

    setError(null)
    startTransition(async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data, error: dbErr } = await supabase.from('wheelchair_requests').insert({
        driver_id:      employeeId,
        bus_id:         activeShift.bus!.id,
        passenger_name: passengerName.trim(),
        airline_id:     airlineId,
        flight_number:  flightNumber.trim(),
      }).select('id').single()

      if (dbErr) { setError(dbErr.message); return }
      setSubmitted(data.id)
      setStatus('pending')
    })
  }

  if (submitted) {
    return (
      <div className="space-y-6">
        {status === 'escalated' ? (
          <div className="bg-red-950/50 border border-red-700 rounded-xl p-6 text-center">
            <div className="text-red-400 text-xl font-bold mb-2">No Dispatcher Response</div>
            <p className="text-red-200 mb-4">
              Your request has been escalated. No response was received from dispatch within 5 minutes.
            </p>
            <p className="text-foreground font-bold text-lg">Please call dispatch directly.</p>
          </div>
        ) : dispatchResponse ? (
          <div className="bg-green-950/50 border border-green-700 rounded-xl p-6">
            <div className="text-green-400 font-bold mb-2">Dispatcher Response</div>
            <p className="text-foreground">{dispatchResponse}</p>
            <span className={`inline-block mt-3 text-xs px-2 py-1 rounded-full font-semibold ${
              status === 'resolved'     ? 'bg-green-800 text-green-200' :
              status === 'acknowledged' ? 'bg-blue-800 text-blue-200'  : 'bg-muted text-foreground'
            }`}>
              Status: {status}
            </span>
          </div>
        ) : (
          <div className="bg-yellow-950/50 border border-yellow-700 rounded-xl p-6 text-center">
            <div className="text-yellow-400 font-bold text-lg mb-2">Request Submitted</div>
            <p className="text-yellow-200 mb-3">Waiting for dispatcher to respond…</p>
            <p className="text-muted-foreground text-sm">For {passengerName} — Flight {flightNumber}</p>
            {status === 'acknowledged' && (
              <p className="text-blue-300 mt-3 text-sm">✓ Dispatcher acknowledged your request</p>
            )}
            <div className="mt-4 text-muted-foreground text-xs">
              If no response within 5 minutes, you will be notified to call dispatch.
            </div>
          </div>
        )}
        <button
          onClick={() => {
            setSubmitted(null); setStatus(null); setDispatchResponse(null)
            setPassengerName(''); setAirlineId(''); setFlightNumber(''); setQuery('')
          }}
          className="text-muted-foreground hover:text-foreground text-sm underline"
        >
          Submit another request
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {existing.length > 0 && (
        <div className="bg-yellow-950/40 border border-yellow-700 rounded-xl p-4 text-sm text-yellow-200">
          <strong>Warning:</strong> Bus {busNumber} already has {existing.length} open wheelchair request{existing.length > 1 ? 's' : ''}.
          {existing.map(r => (
            <div key={r.id} className="mt-1 text-yellow-300">
              • {r.passenger_name} ({r.status})
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="block text-sm text-muted-foreground mb-1">Bus Number</label>
        <div className="bg-muted border border-border rounded-xl px-4 py-3 text-foreground">{busNumber}</div>
      </div>

      <div>
        <label className="block text-sm text-muted-foreground mb-1">Passenger Name</label>
        <input
          value={passengerName}
          onChange={e => setPassengerName(e.target.value)}
          required
          placeholder="Full name"
          className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground placeholder-gray-600 focus:outline-none focus:border-gray-500"
        />
      </div>

      <div>
        <label className="block text-sm text-muted-foreground mb-1">Airline</label>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setAirlineId('') }}
          placeholder="Search airline…"
          className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground placeholder-gray-600 focus:outline-none focus:border-gray-500 mb-1"
        />
        {query && !airlineId && (
          <div className="bg-muted border border-border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
            {filteredAirlines.length === 0 ? (
              <div className="px-4 py-3 text-muted-foreground text-sm">No airlines match</div>
            ) : (
              filteredAirlines.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { setAirlineId(a.id); setQuery(a.name) }}
                  className="w-full text-left px-4 py-3 text-foreground hover:bg-gray-700 text-sm border-b border-border/50 last:border-0"
                >
                  {a.name}
                  <span className="text-muted-foreground ml-2 text-xs">Terminal {a.terminal}</span>
                </button>
              ))
            )}
          </div>
        )}
        {selectedAirline && airlineId && (
          <div className="text-xs text-muted-foreground mt-1">
            Terminal {selectedAirline.terminal}
            {selectedAirline.wheelchair_contact && (
              <span className="ml-2">Contact: {selectedAirline.wheelchair_contact}</span>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm text-muted-foreground mb-1">Flight Number</label>
        <input
          value={flightNumber}
          onChange={e => setFlightNumber(e.target.value)}
          required
          placeholder="e.g. WN 1234"
          className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground placeholder-gray-600 focus:outline-none focus:border-gray-500"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={isPending || !airlineId || !passengerName.trim() || !flightNumber.trim()}
        className="w-full bg-orange-600 hover:bg-orange-500 text-foreground font-bold py-4 rounded-xl text-lg disabled:opacity-40 transition-colors"
      >
        {isPending ? 'Submitting…' : 'Submit 10-51 Request'}
      </button>
    </form>
  )
}
