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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Award, CalendarClock } from 'lucide-react'

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
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Shift Bids</h1>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No active bid cycle at this time.
          </CardContent>
        </Card>
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Shift Bids</h1>

      {/* Cycle info */}
      <Card>
        <CardContent className="p-4 space-y-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-foreground font-semibold min-w-0 truncate">{activeCycle.name}</h2>
            <span className={`px-2.5 py-1 rounded-full text-xs border ${BID_CYCLE_STATUS_COLOR[activeCycle.status]}`}>
              {activeCycle.status}
            </span>
          </div>
          <p className="text-muted-foreground text-sm">Period: {activeCycle.start_date} — {activeCycle.end_date}</p>
          {activeCycle.submission_close_at && (
            <p className="text-muted-foreground text-xs flex items-center gap-1">
              <CalendarClock className="size-3.5 shrink-0" />
              Submissions close: {new Date(activeCycle.submission_close_at).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Award result */}
      {myAward && (
        <Card className="border-ok-border bg-ok-surface">
          <CardContent className="p-4">
            <h2 className="text-ok font-semibold mb-2 flex items-center gap-2">
              <Award className="size-4 shrink-0" /> Your Bid Award
            </h2>
            {myAward.shift_bid_slots ? (
              <div className="text-sm text-foreground space-y-1">
                <p>Bid #{myAward.shift_bid_slots.bid_number} · {ROUTE_TYPE_LABELS[myAward.shift_bid_slots.route_type]}</p>
                <p>Report: {myAward.shift_bid_slots.report_time} · {myAward.shift_bid_slots.shift_start} → {myAward.shift_bid_slots.shift_end}</p>
                <p className="text-ok text-xs">
                  {myAward.preference_rank ? `Preference #${myAward.preference_rank}` : 'Auto-assigned'}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Slot info unavailable.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Available slots */}
      <div>
        <h2 className="text-foreground font-semibold mb-3">Available Slots ({slots.length})</h2>
        <div className="space-y-2">
          {slots.map(slot => (
            <Card key={slot.id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                  <span className="text-foreground font-medium">Bid #{slot.bid_number}</span>
                  <span className="text-muted-foreground text-xs">{ROUTE_TYPE_LABELS[slot.route_type]}</span>
                </div>
                <p className="text-foreground text-sm font-mono">
                  Report {slot.report_time} · {slot.shift_start} → {slot.shift_end}
                </p>
                <p className="text-muted-foreground text-xs mt-1 font-mono">
                  {DAY_KEYS.map((d, i) => (slot as any)[`days_${d}`] ? DAY_LABELS[i] : '·').join(' ')}
                </p>
                {slot.notes && <p className="text-muted-foreground text-xs mt-1">{slot.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Preference form */}
      {canSubmit && (
        <Card>
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            <h2 className="text-foreground font-semibold">Your Preferences</h2>
            <p className="text-muted-foreground text-xs">Select up to 3 slots in order of preference. Higher seniority employees are awarded first.</p>

            {([1,2,3] as const).map(rank => (
              <div key={rank}>
                <Label className="block text-xs text-muted-foreground mb-1">Preference #{rank}</Label>
                <select
                  value={prefs[rank]}
                  onChange={e => setPrefs(p => ({ ...p, [rank]: e.target.value }))}
                  className="w-full bg-card border border-input rounded-lg px-3 py-2.5 text-foreground text-sm"
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

            {err && <p className="text-danger text-sm">{err}</p>}
            {success && <p className="text-ok text-sm">{success}</p>}

            <Button type="submit" size="lg" disabled={pending}>
              {mySubmission ? 'Update Preferences' : 'Submit Preferences'}
            </Button>
          </form>
        </Card>
      )}

      {activeCycle.status === 'locked' && !myAward && (
        <p className="text-muted-foreground text-sm">Submissions are closed. Awards will be announced soon.</p>
      )}
    </div>
  )
}
