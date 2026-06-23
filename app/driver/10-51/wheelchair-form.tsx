'use client'

import { useState, useEffect, useTransition } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { AlertTriangle, Check, PhoneCall } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
          <div className="bg-danger-surface border border-danger-border rounded-xl p-6 text-center">
            <div className="text-danger text-xl font-bold mb-2 inline-flex items-center gap-2">
              <PhoneCall className="size-5" /> No Dispatcher Response
            </div>
            <p className="text-danger mb-4">
              Your request has been escalated. No response was received from dispatch within 5 minutes.
            </p>
            <p className="text-foreground font-bold text-lg">Please call dispatch directly.</p>
          </div>
        ) : dispatchResponse ? (
          <div className="bg-ok-surface border border-ok-border rounded-xl p-6">
            <div className="text-ok font-bold mb-2">Dispatcher Response</div>
            <p className="text-foreground">{dispatchResponse}</p>
            <Badge
              variant={status === 'resolved' ? 'ok' : status === 'acknowledged' ? 'info' : 'neutral'}
              className="mt-3"
            >
              Status: {status}
            </Badge>
          </div>
        ) : (
          <div className="bg-warn-surface border border-warn-border rounded-xl p-6 text-center">
            <div className="text-warn font-bold text-lg mb-2">Request Submitted</div>
            <p className="text-warn mb-3">Waiting for dispatcher to respond…</p>
            <p className="text-muted-foreground text-sm">For {passengerName} — Flight {flightNumber}</p>
            {status === 'acknowledged' && (
              <p className="text-info mt-3 text-sm inline-flex items-center gap-1">
                <Check className="size-4" /> Dispatcher acknowledged your request
              </p>
            )}
            <div className="mt-4 text-muted-foreground text-xs">
              If no response within 5 minutes, you will be notified to call dispatch.
            </div>
          </div>
        )}
        <Button
          variant="link"
          onClick={() => {
            setSubmitted(null); setStatus(null); setDispatchResponse(null)
            setPassengerName(''); setAirlineId(''); setFlightNumber(''); setQuery('')
          }}
        >
          Submit another request
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {existing.length > 0 && (
        <div className="bg-warn-surface border border-warn-border rounded-xl p-4 text-sm text-warn">
          <strong className="inline-flex items-center gap-1">
            <AlertTriangle className="size-4" /> Warning:
          </strong>{' '}
          Bus {busNumber} already has {existing.length} open wheelchair request{existing.length > 1 ? 's' : ''}.
          {existing.map(r => (
            <div key={r.id} className="mt-1 text-warn">
              • {r.passenger_name} ({r.status})
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Bus Number</Label>
        <div className="bg-muted border border-border rounded-lg px-4 py-3 text-foreground">{busNumber}</div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wc-passenger">Passenger Name</Label>
        <Input
          id="wc-passenger"
          value={passengerName}
          onChange={e => setPassengerName(e.target.value)}
          required
          placeholder="Full name"
          className="h-12 text-base"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wc-airline">Airline</Label>
        <Input
          id="wc-airline"
          value={query}
          onChange={e => { setQuery(e.target.value); setAirlineId('') }}
          placeholder="Search airline…"
          className="h-12 text-base"
        />
        {query && !airlineId && (
          <div className="bg-card border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
            {filteredAirlines.length === 0 ? (
              <div className="px-4 py-3 text-muted-foreground text-sm">No airlines match</div>
            ) : (
              filteredAirlines.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { setAirlineId(a.id); setQuery(a.name) }}
                  className="w-full text-left px-4 py-3 text-foreground hover:bg-accent text-sm border-b border-border/50 last:border-0"
                >
                  {a.name}
                  <span className="text-muted-foreground ml-2 text-xs">Terminal {a.terminal}</span>
                </button>
              ))
            )}
          </div>
        )}
        {selectedAirline && airlineId && (
          <div className="text-xs text-muted-foreground">
            Terminal {selectedAirline.terminal}
            {selectedAirline.wheelchair_contact && (
              <span className="ml-2">Contact: {selectedAirline.wheelchair_contact}</span>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wc-flight">Flight Number</Label>
        <Input
          id="wc-flight"
          value={flightNumber}
          onChange={e => setFlightNumber(e.target.value)}
          required
          placeholder="e.g. WN 1234"
          className="h-12 text-base"
        />
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}

      <Button
        type="submit"
        size="xl"
        disabled={isPending || !airlineId || !passengerName.trim() || !flightNumber.trim()}
        className="w-full bg-warn text-white hover:bg-warn/90"
      >
        {isPending ? 'Submitting…' : 'Submit 10-51 Request'}
      </Button>
    </form>
  )
}
