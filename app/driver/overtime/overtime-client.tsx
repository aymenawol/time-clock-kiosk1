'use client'
import { useState, useTransition } from 'react'
import { OvertimeShift, OffDayRequest, OtBanner } from '@/lib/supabase'
import { submitOtBidAction, respondOffDayAction } from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertTriangle, Check } from 'lucide-react'

interface Props {
  banner: OtBanner | null
  openShifts: (OvertimeShift & { my_bid: boolean })[]
  myBidShifts: OvertimeShift[]
  myAwardedShifts: OvertimeShift[]
  offDayRequests: OffDayRequest[]
}

export default function DriverOvertimeClient({ banner, openShifts, myBidShifts, myAwardedShifts, offDayRequests }: Props) {
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [customText, setCustomText] = useState('')
  const [availStart, setAvailStart] = useState('')
  const [availHours, setAvailHours] = useState('')

  function act(fn: () => Promise<void>) {
    setErr(null)
    startTransition(async () => { try { await fn() } catch (e: any) { setErr(e.message) } })
  }

  function handleBid(shiftId: string) {
    act(() => submitOtBidAction(shiftId))
  }

  function handleRespond(req: OffDayRequest, resp: 'accepted' | 'declined' | 'custom') {
    act(() => respondOffDayAction(
      req.id, resp,
      resp === 'custom' ? availStart : undefined,
      resp === 'custom' && availHours ? Number(availHours) : undefined,
      resp === 'custom' ? customText : undefined,
    ))
    setRespondingId(null)
  }

  const pendingRequests = offDayRequests.filter(r => r.response === 'pending')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Overtime</h1>

      {err && <p className="text-danger text-sm bg-danger-surface border border-danger-border rounded-lg px-3 py-2">{err}</p>}

      {/* OT Banner */}
      {banner?.is_active && (
        <div className="bg-warn-surface border border-warn-border rounded-lg p-4 flex items-start gap-2">
          <AlertTriangle className="size-4 text-warn shrink-0 mt-0.5" />
          <p className="text-warn text-sm min-w-0">{banner.message}</p>
        </div>
      )}

      {/* Off-Day Requests */}
      {pendingRequests.length > 0 && (
        <section>
          <h2 className="text-foreground font-semibold mb-3">Off-Day Work Requests</h2>
          <div className="space-y-3">
            {pendingRequests.map(req => (
              <Card key={req.id} className="border-warn-border">
                <CardContent className="p-4">
                  <p className="text-foreground text-sm font-medium">Work request for {req.requested_date}</p>
                  {req.message && <p className="text-muted-foreground text-sm mt-1">{req.message}</p>}

                  {respondingId === req.id ? (
                    <div className="mt-3 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <Label className="block text-xs text-muted-foreground mb-1">Available Start</Label>
                          <Input type="time" value={availStart} onChange={e => setAvailStart(e.target.value)} />
                        </div>
                        <div>
                          <Label className="block text-xs text-muted-foreground mb-1">Available Hours</Label>
                          <Input type="number" step="0.5" value={availHours} onChange={e => setAvailHours(e.target.value)} />
                        </div>
                      </div>
                      <div>
                        <Label className="block text-xs text-muted-foreground mb-1">Additional Note</Label>
                        <Input value={customText} onChange={e => setCustomText(e.target.value)} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => handleRespond(req, 'custom')} disabled={pending} size="sm">Send</Button>
                        <Button onClick={() => setRespondingId(null)} variant="secondary" size="sm">Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Button onClick={() => handleRespond(req, 'accepted')} disabled={pending} variant="success" size="sm">
                        Accept
                      </Button>
                      <Button onClick={() => handleRespond(req, 'declined')} disabled={pending} variant="destructive" size="sm">
                        Decline
                      </Button>
                      <Button onClick={() => setRespondingId(req.id)} variant="secondary" size="sm">
                        Custom Availability
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Open OT Shifts */}
      <section>
        <h2 className="text-foreground font-semibold mb-3">Open Overtime Shifts</h2>
        {openShifts.length === 0 ? (
          <p className="text-muted-foreground text-sm">No open overtime shifts right now.</p>
        ) : (
          <div className="space-y-2">
            {openShifts.map(shift => (
              <Card key={shift.id}>
                <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-foreground font-medium text-sm">{shift.date}</p>
                    <p className="text-muted-foreground text-xs">{shift.start_time} · {shift.duration_hours}h</p>
                    {shift.description && <p className="text-muted-foreground text-xs mt-0.5">{shift.description}</p>}
                    {shift.bid_close_at && (
                      <p className="text-muted-foreground text-xs">Bid by {new Date(shift.bid_close_at).toLocaleString()}</p>
                    )}
                  </div>
                  {shift.my_bid ? (
                    <span className="text-ok text-xs font-medium flex items-center gap-1 shrink-0">
                      <Check className="size-3.5" /> Bid submitted
                    </span>
                  ) : (
                    <Button onClick={() => handleBid(shift.id)} disabled={pending} size="sm" className="shrink-0">
                      Bid
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Awarded Shifts */}
      {myAwardedShifts.length > 0 && (
        <section>
          <h2 className="text-foreground font-semibold mb-3">Your Awarded Overtime</h2>
          <div className="space-y-2">
            {myAwardedShifts.map(shift => (
              <Card key={shift.id} className="border-ok-border bg-ok-surface">
                <CardContent className="p-3">
                  <p className="text-ok font-medium text-sm">{shift.date}</p>
                  <p className="text-ok text-xs">{shift.start_time} · {shift.duration_hours}h</p>
                  {shift.description && <p className="text-muted-foreground text-xs mt-0.5">{shift.description}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
