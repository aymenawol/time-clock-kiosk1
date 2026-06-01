'use client'
import { useState, useTransition } from 'react'
import {
  ShiftBidCycle,
  ShiftBidSlot,
  ShiftBidSubmission,
  ShiftBidAward,
  BID_CYCLE_STATUS_COLOR,
  ROUTE_TYPE_LABELS,
} from '@/lib/supabase'
import { submitBidAction } from './actions'

const DAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat'] as const
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa']

interface Props {
  activeCycle: ShiftBidCycle | null
  slots: ShiftBidSlot[]
  mySubmission: ShiftBidSubmission | null
  myAward: (ShiftBidAward & { shift_bid_slots: ShiftBidSlot | null }) | null
}

export default function DriverBidsClient({ activeCycle, slots, mySubmission, myAward }: Props) {
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Preference state: slot_id for rank 1, 2, 3
  const existingPrefs = mySubmission?.preferences as { slot_id: string; rank: number }[] | undefined
  const init: Record<1|2|3, string> = {
    1: existingPrefs?.find(p => p.rank === 1)?.slot_id ?? '',
    2: existingPrefs?.find(p => p.rank === 2)?.slot_id ?? '',
    3: existingPrefs?.find(p => p.rank === 3)?.slot_id ?? '',
  }
  const [prefs, setPrefs] = useState<Record<1|2|3, string>>(init)

  if (!activeCycle) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-4">Shift Bids</h1>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center text-gray-500">
          No active bid cycle at this time.
        </div>
      </div>
    )
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErr(null); setSuccess(null)
    const preferences: { slot_id: string; rank: 1|2|3 }[] = []
    ;([1,2,3] as const).forEach(rank => {
      if (prefs[rank]) preferences.push({ slot_id: prefs[rank], rank })
    })
    if (preferences.length === 0) { setErr('Select at least one preference'); return }
    if (!activeCycle) { setErr('No active bid cycle'); return }
    startTransition(async () => {
      try { await submitBidAction(activeCycle.id, preferences); setSuccess('Preferences saved!') }
      catch (e: any) { setErr(e.message) }
    })
  }

  const canSubmit = activeCycle.status === 'published'

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">Shift Bids</h1>

      {/* Cycle info */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-white font-semibold">{activeCycle.name}</h2>
          <span className={`px-2.5 py-1 rounded-full text-xs border ${BID_CYCLE_STATUS_COLOR[activeCycle.status]}`}>
            {activeCycle.status}
          </span>
        </div>
        <p className="text-gray-400 text-sm">Period: {activeCycle.start_date} — {activeCycle.end_date}</p>
        {activeCycle.submission_close_at && (
          <p className="text-gray-500 text-xs mt-0.5">Submissions close: {new Date(activeCycle.submission_close_at).toLocaleString()}</p>
        )}
      </div>

      {/* Award result */}
      {myAward && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-6">
          <h2 className="text-green-300 font-semibold mb-2">Your Bid Award</h2>
          {myAward.shift_bid_slots ? (
            <div className="text-sm text-green-200 space-y-1">
              <p>Bid #{myAward.shift_bid_slots.bid_number} · {ROUTE_TYPE_LABELS[myAward.shift_bid_slots.route_type]}</p>
              <p>Report: {myAward.shift_bid_slots.report_time} · {myAward.shift_bid_slots.shift_start} → {myAward.shift_bid_slots.shift_end}</p>
              <p className="text-green-400 text-xs">
                {myAward.preference_rank ? `Preference #${myAward.preference_rank}` : 'Auto-assigned'}
              </p>
            </div>
          ) : (
            <p className="text-green-300 text-sm">Slot info unavailable.</p>
          )}
        </div>
      )}

      {/* Available slots */}
      <div className="mb-6">
        <h2 className="text-white font-semibold mb-3">Available Slots ({slots.length})</h2>
        <div className="space-y-2">
          {slots.map(slot => (
            <div key={slot.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white font-medium">Bid #{slot.bid_number}</span>
                <span className="text-gray-400 text-xs">{ROUTE_TYPE_LABELS[slot.route_type]}</span>
              </div>
              <p className="text-gray-300 text-sm font-mono">
                Report {slot.report_time} · {slot.shift_start} → {slot.shift_end}
              </p>
              <p className="text-gray-500 text-xs mt-1 font-mono">
                {DAY_KEYS.map((d, i) => (slot as any)[`days_${d}`] ? DAY_LABELS[i] : '·').join(' ')}
              </p>
              {slot.notes && <p className="text-gray-500 text-xs mt-1">{slot.notes}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Preference form */}
      {canSubmit && (
        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
          <h2 className="text-white font-semibold">Your Preferences</h2>
          <p className="text-gray-400 text-xs">Select up to 3 slots in order of preference. Higher seniority employees are awarded first.</p>

          {([1,2,3] as const).map(rank => (
            <div key={rank}>
              <label className="block text-xs text-gray-400 mb-1">Preference #{rank}</label>
              <select
                value={prefs[rank]}
                onChange={e => setPrefs(p => ({ ...p, [rank]: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
              >
                <option value="">— No preference —</option>
                {slots.map(slot => (
                  <option key={slot.id} value={slot.id} disabled={Object.values(prefs).includes(slot.id) && prefs[rank] !== slot.id}>
                    Bid #{slot.bid_number} · {ROUTE_TYPE_LABELS[slot.route_type]} · {slot.shift_start}–{slot.shift_end}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {err && <p className="text-red-400 text-sm">{err}</p>}
          {success && <p className="text-green-400 text-sm">{success}</p>}

          <button type="submit" disabled={pending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded">
            {mySubmission ? 'Update Preferences' : 'Submit Preferences'}
          </button>
        </form>
      )}

      {activeCycle.status === 'locked' && !myAward && (
        <p className="text-gray-500 text-sm mt-4">Submissions are closed. Awards will be announced soon.</p>
      )}
    </div>
  )
}
