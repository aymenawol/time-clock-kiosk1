'use client'
import { useState, useTransition } from 'react'
import { Plus, X } from 'lucide-react'
import { OvertimeShift, OtBanner } from '@/lib/supabase'
import { postOtShiftAction, closeOtShiftAction, updateBannerAction, sendOffDayRequestAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface OffDayReq { id: string; employee_id: string; requested_date: string; message: string | null; response: string; employees: { name: string } | null }
interface Employee { id: string; name: string }

interface Props {
  banner: OtBanner | null
  shifts: (OvertimeShift & { bid_count: number })[]
  offDayRequests: OffDayReq[]
  employees: Employee[]
}

export default function DispatcherOvertimeClient({ banner, shifts, offDayRequests, employees }: Props) {
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [bannerMsg, setBannerMsg] = useState(banner?.message ?? '')
  const [bannerActive, setBannerActive] = useState(banner?.is_active ?? false)
  const [showShiftForm, setShowShiftForm] = useState(false)
  const [showOffDayForm, setShowOffDayForm] = useState(false)

  function act(fn: () => Promise<void>) {
    setErr(null)
    startTransition(async () => { try { await fn() } catch (e: any) { setErr(e.message) } })
  }

  function handleShiftPost(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    act(async () => { await postOtShiftAction(fd); setShowShiftForm(false) })
  }

  function handleOffDay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    act(async () => { await sendOffDayRequestAction(fd); setShowOffDayForm(false) })
  }

  const STATUS_COLOR: Record<string, string> = {
    open:      'text-ok',
    closed:    'text-muted-foreground',
    awarded:   'text-info',
    cancelled: 'text-danger',
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-foreground">Overtime Management</h1>

      {err && <p className="text-danger text-sm bg-danger-surface border border-danger-border rounded px-3 py-2">{err}</p>}

      {/* OT Banner */}
      <section className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h2 className="text-foreground font-semibold">OT Banner</h2>
        <div className="flex items-center gap-3">
          <Button
            variant={bannerActive ? 'default' : 'secondary'}
            size="sm"
            onClick={() => { setBannerActive(v => !v); act(() => updateBannerAction(!bannerActive, bannerMsg)) }}
          >
            {bannerActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
          </Button>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Banner Message</label>
          <Input value={bannerMsg} onChange={e => setBannerMsg(e.target.value)} />
        </div>
        <Button variant="secondary" size="sm" onClick={() => act(() => updateBannerAction(bannerActive, bannerMsg))} disabled={pending}>
          Save Banner
        </Button>
      </section>

      {/* Post OT Shift */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-foreground font-semibold">Overtime Shifts</h2>
          <Button variant="secondary" size="sm" onClick={() => setShowShiftForm(v => !v)}>
            {showShiftForm ? <X aria-hidden /> : <Plus aria-hidden />}
            {showShiftForm ? 'Cancel' : 'Post Shift'}
          </Button>
        </div>

        {showShiftForm && (
          <form onSubmit={handleShiftPost} className="bg-card border border-border rounded-lg p-4 mb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Date *</label>
                <Input name="date" type="date" required />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Start Time *</label>
                <Input name="start_time" type="time" required />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Duration (hours) *</label>
                <Input name="duration_hours" type="number" step="0.25" required />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Slots Available</label>
                <Input name="slots_available" type="number" defaultValue={1} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Bid Close (optional)</label>
                <Input name="bid_close_at" type="datetime-local" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Description</label>
                <Input name="description" />
              </div>
            </div>
            <Button type="submit" size="sm" disabled={pending}>
              Post Shift
            </Button>
          </form>
        )}

        <div className="space-y-2">
          {shifts.length === 0 && <p className="text-muted-foreground text-sm">No shifts posted.</p>}
          {shifts.map(s => (
            <div key={s.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-foreground text-sm font-medium">{s.date} {s.start_time} · {s.duration_hours}h</p>
                {s.description && <p className="text-muted-foreground text-xs">{s.description}</p>}
                <p className="text-muted-foreground text-xs">{s.bid_count} bid{s.bid_count !== 1 ? 's' : ''} · {s.slots_available} slot{s.slots_available !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-xs font-medium ${STATUS_COLOR[s.status]}`}>{s.status}</span>
                {s.status === 'open' && (
                  <button onClick={() => act(() => closeOtShiftAction(s.id))} disabled={pending}
                    className="text-xs text-warn hover:text-warn/80 disabled:opacity-50">Close</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Off-Day Requests */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-foreground font-semibold">Off-Day Work Requests</h2>
          <Button variant="secondary" size="sm" onClick={() => setShowOffDayForm(v => !v)}>
            {showOffDayForm ? <X aria-hidden /> : <Plus aria-hidden />}
            {showOffDayForm ? 'Cancel' : 'Send Request'}
          </Button>
        </div>

        {showOffDayForm && (
          <form onSubmit={handleOffDay} className="bg-card border border-border rounded-lg p-4 mb-4 space-y-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Employee *</label>
              <select name="employee_id" required className="w-full h-10 bg-card border border-input rounded-lg px-3 py-2 text-foreground text-sm">
                <option value="">— Select —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Requested Date *</label>
              <Input name="requested_date" type="date" required />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Message</label>
              <Textarea name="message" rows={2} />
            </div>
            <Button type="submit" size="sm" disabled={pending}>
              Send Request
            </Button>
          </form>
        )}

        <div className="space-y-2">
          {offDayRequests.length === 0 && <p className="text-muted-foreground text-sm">No off-day requests.</p>}
          {offDayRequests.map(r => (
            <div key={r.id} className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-foreground text-sm min-w-0 truncate">{r.employees?.name ?? r.employee_id}</p>
                <span className={`text-xs font-medium shrink-0 ${
                  r.response === 'accepted' ? 'text-ok' :
                  r.response === 'declined' ? 'text-danger' :
                  r.response === 'custom'   ? 'text-info' : 'text-warn'
                }`}>{r.response}</span>
              </div>
              <p className="text-muted-foreground text-xs">{r.requested_date}</p>
              {r.message && <p className="text-muted-foreground text-xs mt-0.5">{r.message}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
