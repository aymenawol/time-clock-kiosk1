'use client'
import { useState, useTransition } from 'react'
import { OvertimeShift, OtBanner } from '@/lib/supabase'
import { postOtShiftAction, closeOtShiftAction, updateBannerAction, sendOffDayRequestAction } from './actions'

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
    open:      'text-green-400',
    closed:    'text-muted-foreground',
    awarded:   'text-blue-400',
    cancelled: 'text-red-500',
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-foreground">Overtime Management</h1>

      {err && <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded px-3 py-2">{err}</p>}

      {/* OT Banner */}
      <section className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h2 className="text-foreground font-semibold">OT Banner</h2>
        <div className="flex items-center gap-3">
          <button onClick={() => { setBannerActive(v => !v); act(() => updateBannerAction(!bannerActive, bannerMsg)) }}
            className={`px-3 py-1.5 text-sm rounded font-medium ${bannerActive ? 'bg-yellow-600 text-foreground' : 'bg-muted text-muted-foreground'}`}>
            {bannerActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
          </button>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Banner Message</label>
          <input value={bannerMsg} onChange={e => setBannerMsg(e.target.value)}
            className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-sm" />
        </div>
        <button onClick={() => act(() => updateBannerAction(bannerActive, bannerMsg))} disabled={pending}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-foreground text-xs rounded disabled:opacity-50">
          Save Banner
        </button>
      </section>

      {/* Post OT Shift */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-foreground font-semibold">Overtime Shifts</h2>
          <button onClick={() => setShowShiftForm(v => !v)}
            className="px-3 py-1.5 bg-muted hover:bg-gray-700 text-foreground text-sm border border-border rounded">
            {showShiftForm ? 'Cancel' : '+ Post Shift'}
          </button>
        </div>

        {showShiftForm && (
          <form onSubmit={handleShiftPost} className="bg-card border border-border rounded-lg p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Date *</label>
                <input name="date" type="date" required className="w-full bg-muted border border-border rounded px-2 py-1.5 text-foreground text-sm" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Start Time *</label>
                <input name="start_time" type="time" required className="w-full bg-muted border border-border rounded px-2 py-1.5 text-foreground text-sm" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Duration (hours) *</label>
                <input name="duration_hours" type="number" step="0.25" required className="w-full bg-muted border border-border rounded px-2 py-1.5 text-foreground text-sm" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Slots Available</label>
                <input name="slots_available" type="number" defaultValue={1} className="w-full bg-muted border border-border rounded px-2 py-1.5 text-foreground text-sm" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Bid Close (optional)</label>
                <input name="bid_close_at" type="datetime-local" className="w-full bg-muted border border-border rounded px-2 py-1.5 text-foreground text-sm" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Description</label>
                <input name="description" className="w-full bg-muted border border-border rounded px-2 py-1.5 text-foreground text-sm" />
              </div>
            </div>
            <button type="submit" disabled={pending}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-foreground text-xs rounded disabled:opacity-50">
              Post Shift
            </button>
          </form>
        )}

        <div className="space-y-2">
          {shifts.length === 0 && <p className="text-muted-foreground text-sm">No shifts posted.</p>}
          {shifts.map(s => (
            <div key={s.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-foreground text-sm font-medium">{s.date} {s.start_time} · {s.duration_hours}h</p>
                {s.description && <p className="text-muted-foreground text-xs">{s.description}</p>}
                <p className="text-muted-foreground text-xs">{s.bid_count} bid{s.bid_count !== 1 ? 's' : ''} · {s.slots_available} slot{s.slots_available !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-xs font-medium ${STATUS_COLOR[s.status]}`}>{s.status}</span>
                {s.status === 'open' && (
                  <button onClick={() => act(() => closeOtShiftAction(s.id))} disabled={pending}
                    className="text-xs text-yellow-500 hover:text-yellow-400 disabled:opacity-50">Close</button>
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
          <button onClick={() => setShowOffDayForm(v => !v)}
            className="px-3 py-1.5 bg-muted hover:bg-gray-700 text-foreground text-sm border border-border rounded">
            {showOffDayForm ? 'Cancel' : '+ Send Request'}
          </button>
        </div>

        {showOffDayForm && (
          <form onSubmit={handleOffDay} className="bg-card border border-border rounded-lg p-4 mb-4 space-y-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Employee *</label>
              <select name="employee_id" required className="w-full bg-muted border border-border rounded px-2 py-1.5 text-foreground text-sm">
                <option value="">— Select —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Requested Date *</label>
              <input name="requested_date" type="date" required className="w-full bg-muted border border-border rounded px-2 py-1.5 text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Message</label>
              <textarea name="message" rows={2} className="w-full bg-muted border border-border rounded px-2 py-1.5 text-foreground text-sm" />
            </div>
            <button type="submit" disabled={pending}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-foreground text-xs rounded disabled:opacity-50">
              Send Request
            </button>
          </form>
        )}

        <div className="space-y-2">
          {offDayRequests.length === 0 && <p className="text-muted-foreground text-sm">No off-day requests.</p>}
          {offDayRequests.map(r => (
            <div key={r.id} className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <p className="text-foreground text-sm">{r.employees?.name ?? r.employee_id}</p>
                <span className={`text-xs font-medium ${
                  r.response === 'accepted' ? 'text-green-400' :
                  r.response === 'declined' ? 'text-red-400' :
                  r.response === 'custom'   ? 'text-blue-400' : 'text-yellow-400'
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
