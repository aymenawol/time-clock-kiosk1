'use client'
import { useTransition, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { OvertimeShift, OtBanner } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  postOtShiftAction,
  closeOtShiftAction,
  cancelOtShiftAction,
  awardOtShiftAction,
  updateBannerAction,
  sendOffDayRequestAction,
} from './actions'

const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  open:      'ok',
  closed:    'warn',
  awarded:   'info',
  cancelled: 'neutral',
}

interface OffDayReq {
  id: string
  employees: { name: string } | null
  requested_date: string
  message: string | null
  response: string
  available_start_time: string | null
  available_hours: number | null
  custom_availability: string | null
  responded_at: string | null
}

interface Props {
  shifts: (OvertimeShift & { bid_count: number; award_count: number })[]
  offDayRequests: OffDayReq[]
  banner: OtBanner
  employees: { id: string; name: string }[]
}

export default function AdminOvertimeClient({ shifts, offDayRequests, banner, employees }: Props) {
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [showPostForm, setShowPostForm] = useState(false)
  const [showOffDayForm, setShowOffDayForm] = useState(false)
  const [bannerActive, setBannerActive] = useState(banner.is_active)
  const [bannerMsg, setBannerMsg] = useState(banner.message)

  function act(fn: () => Promise<void>) {
    setErr(null)
    startTransition(async () => { try { await fn() } catch (e: any) { setErr(e.message) } })
  }

  function handlePostShift(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    act(async () => { await postOtShiftAction(fd); setShowPostForm(false) })
  }

  function handleSendOffDay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    act(async () => { await sendOffDayRequestAction(fd); setShowOffDayForm(false) })
  }

  function handleBannerSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    act(() => updateBannerAction(fd))
  }

  function offDayVariant(response: string): BadgeProps['variant'] {
    if (response === 'accepted') return 'ok'
    if (response === 'declined') return 'danger'
    if (response === 'custom') return 'info'
    return 'neutral'
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-foreground">Overtime Management</h1>

      {err && <p className="text-danger text-sm bg-danger-surface border border-danger-border rounded-lg px-3 py-2">{err}</p>}

      {/* OT Banner */}
      <Card className="p-4 sm:p-5">
        <h2 className="text-foreground font-semibold mb-3">OT Availability Banner</h2>
        <form onSubmit={handleBannerSave} className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Label>Active</Label>
            <input type="hidden" name="is_active" value={bannerActive ? 'true' : 'false'} />
            <button type="button" onClick={() => setBannerActive(v => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors ${bannerActive ? 'bg-ok' : 'bg-muted'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${bannerActive ? 'left-5' : 'left-0.5'}`} />
            </button>
            <span className={`text-xs ${bannerActive ? 'text-ok' : 'text-muted-foreground'}`}>{bannerActive ? 'Visible to drivers' : 'Hidden'}</span>
          </div>
          <div className="space-y-1">
            <Label htmlFor="banner-message">Message</Label>
            <Textarea id="banner-message" name="message" value={bannerMsg} onChange={e => setBannerMsg(e.target.value)} rows={2} />
          </div>
          <Button type="submit" size="sm" disabled={pending}>Save Banner</Button>
        </form>
      </Card>

      {/* OT Shifts */}
      <section>
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h2 className="text-foreground font-semibold">Overtime Shifts</h2>
          <Button variant="secondary" size="sm" onClick={() => setShowPostForm(v => !v)}>
            {showPostForm ? <><X className="size-4" /> Cancel</> : <><Plus className="size-4" /> Post Shift</>}
          </Button>
        </div>

        {showPostForm && (
          <Card className="p-4 sm:p-5 mb-4">
            <form onSubmit={handlePostShift} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="ot-date">Date *</Label>
                  <Input id="ot-date" name="date" type="date" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ot-start">Start Time *</Label>
                  <Input id="ot-start" name="start_time" type="time" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ot-duration">Duration (hours) *</Label>
                  <Input id="ot-duration" name="duration_hours" type="number" step="0.5" min="0.5" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ot-slots">Slots Available</Label>
                  <Input id="ot-slots" name="slots_available" type="number" min="1" defaultValue={1} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ot-close">Bid Close At</Label>
                  <Input id="ot-close" name="bid_close_at" type="datetime-local" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ot-desc">Description</Label>
                  <Input id="ot-desc" name="description" />
                </div>
              </div>
              <Button type="submit" variant="success" size="sm" disabled={pending}>Post Shift</Button>
            </form>
          </Card>
        )}

        {shifts.length === 0 ? (
          <p className="text-muted-foreground text-sm">No overtime shifts posted.</p>
        ) : (
          <div className="space-y-2">
            {shifts.map(shift => (
              <Card key={shift.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-foreground text-sm font-medium">{shift.date}</span>
                    <span className="text-muted-foreground text-xs">{shift.start_time} · {shift.duration_hours}h</span>
                    <Badge variant={STATUS_VARIANT[shift.status] ?? 'neutral'}>{shift.status}</Badge>
                  </div>
                  {shift.description && <p className="text-muted-foreground text-xs">{shift.description}</p>}
                  <p className="text-muted-foreground text-xs">{shift.bid_count} bid(s) · {shift.award_count} awarded · {shift.slots_available} slots</p>
                </div>
                <div className="flex gap-1 shrink-0 flex-wrap">
                  {shift.status === 'open' && (
                    <>
                      <Button variant="ghost" size="sm" className="text-warn hover:text-warn" onClick={() => act(() => closeOtShiftAction(shift.id))} disabled={pending}>Close</Button>
                      <Button variant="ghost" size="sm" className="text-ok hover:text-ok" onClick={() => act(() => awardOtShiftAction(shift.id))} disabled={pending}>Award</Button>
                      <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => act(() => cancelOtShiftAction(shift.id))} disabled={pending}>Cancel</Button>
                    </>
                  )}
                  {shift.status === 'closed' && (
                    <Button variant="ghost" size="sm" className="text-ok hover:text-ok" onClick={() => act(() => awardOtShiftAction(shift.id))} disabled={pending}>Award</Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Off-Day Requests */}
      <section>
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h2 className="text-foreground font-semibold">Off-Day Work Requests</h2>
          <Button variant="secondary" size="sm" onClick={() => setShowOffDayForm(v => !v)}>
            {showOffDayForm ? <><X className="size-4" /> Cancel</> : <><Plus className="size-4" /> Send Request</>}
          </Button>
        </div>

        {showOffDayForm && (
          <Card className="p-4 sm:p-5 mb-4">
            <form onSubmit={handleSendOffDay} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="od-employee">Employee *</Label>
                  <select id="od-employee" name="employee_id" required className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:border-ring">
                    <option value="">Select employee</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="od-date">Date *</Label>
                  <Input id="od-date" name="requested_date" type="date" required />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="od-message">Message</Label>
                <Textarea id="od-message" name="message" rows={2} />
              </div>
              <Button type="submit" size="sm" disabled={pending}>Send Request</Button>
            </form>
          </Card>
        )}

        {offDayRequests.length === 0 ? (
          <p className="text-muted-foreground text-sm">No off-day requests sent.</p>
        ) : (
          <div className="space-y-2">
            {offDayRequests.map(req => (
              <Card key={req.id} className="p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-foreground text-sm">{req.employees?.name ?? req.id}</span>
                  <span className="text-muted-foreground text-xs ml-2">{req.requested_date}</span>
                  {req.message && <p className="text-muted-foreground text-xs mt-0.5">{req.message}</p>}
                  {(req.response === 'accepted' || req.response === 'custom') && (
                    <p className="text-ok text-xs mt-1">
                      {req.available_start_time && `From ${req.available_start_time}`}
                      {req.available_hours && ` · ${req.available_hours}h available`}
                      {req.custom_availability && ` · ${req.custom_availability}`}
                    </p>
                  )}
                </div>
                <Badge variant={offDayVariant(req.response)} className="shrink-0">{req.response}</Badge>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
