'use client'
import { useState, useTransition } from 'react'
import { OvertimeShift, OffDayRequest, OtBanner } from '@/lib/supabase'
import { submitOtBidAction, respondOffDayAction } from './actions'

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
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Overtime</h1>

      {err && <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded px-3 py-2">{err}</p>}

      {/* OT Banner */}
      {banner?.is_active && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
          <p className="text-yellow-200 text-sm">{banner.message}</p>
        </div>
      )}

      {/* Off-Day Requests */}
      {pendingRequests.length > 0 && (
        <section>
          <h2 className="text-white font-semibold mb-3">Off-Day Work Requests</h2>
          <div className="space-y-3">
            {pendingRequests.map(req => (
              <div key={req.id} className="bg-gray-900 border border-yellow-700/50 rounded-lg p-4">
                <p className="text-white text-sm font-medium">Work request for {req.requested_date}</p>
                {req.message && <p className="text-gray-400 text-sm mt-1">{req.message}</p>}

                {respondingId === req.id ? (
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Available Start</label>
                        <input type="time" value={availStart} onChange={e => setAvailStart(e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Available Hours</label>
                        <input type="number" step="0.5" value={availHours} onChange={e => setAvailHours(e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Additional Note</label>
                      <input value={customText} onChange={e => setCustomText(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleRespond(req, 'custom')} disabled={pending}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded disabled:opacity-50">Send</button>
                      <button onClick={() => setRespondingId(null)}
                        className="px-3 py-1.5 bg-gray-800 text-gray-400 text-xs rounded">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => handleRespond(req, 'accepted')} disabled={pending}
                      className="px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded disabled:opacity-50">
                      Accept
                    </button>
                    <button onClick={() => handleRespond(req, 'declined')} disabled={pending}
                      className="px-3 py-1.5 bg-red-800 hover:bg-red-700 text-white text-xs rounded disabled:opacity-50">
                      Decline
                    </button>
                    <button onClick={() => setRespondingId(req.id)}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded">
                      Custom Availability
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Open OT Shifts */}
      <section>
        <h2 className="text-white font-semibold mb-3">Open Overtime Shifts</h2>
        {openShifts.length === 0 ? (
          <p className="text-gray-500 text-sm">No open overtime shifts right now.</p>
        ) : (
          <div className="space-y-2">
            {openShifts.map(shift => (
              <div key={shift.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-white font-medium text-sm">{shift.date}</p>
                  <p className="text-gray-400 text-xs">{shift.start_time} · {shift.duration_hours}h</p>
                  {shift.description && <p className="text-gray-500 text-xs mt-0.5">{shift.description}</p>}
                  {shift.bid_close_at && (
                    <p className="text-gray-500 text-xs">Bid by {new Date(shift.bid_close_at).toLocaleString()}</p>
                  )}
                </div>
                {shift.my_bid ? (
                  <span className="text-green-400 text-xs font-medium">Bid submitted ✓</span>
                ) : (
                  <button onClick={() => handleBid(shift.id)} disabled={pending}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded disabled:opacity-50">
                    Bid
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Awarded Shifts */}
      {myAwardedShifts.length > 0 && (
        <section>
          <h2 className="text-white font-semibold mb-3">Your Awarded Overtime</h2>
          <div className="space-y-2">
            {myAwardedShifts.map(shift => (
              <div key={shift.id} className="bg-green-900/20 border border-green-800 rounded-lg p-3">
                <p className="text-green-300 font-medium text-sm">{shift.date}</p>
                <p className="text-green-400 text-xs">{shift.start_time} · {shift.duration_hours}h</p>
                {shift.description && <p className="text-green-500 text-xs mt-0.5">{shift.description}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
