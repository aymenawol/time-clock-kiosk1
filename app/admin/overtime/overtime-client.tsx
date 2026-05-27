'use client'
import { useTransition, useState } from 'react'
import { OvertimeShift, OtBanner } from '@/lib/supabase'
import {
  postOtShiftAction,
  closeOtShiftAction,
  cancelOtShiftAction,
  awardOtShiftAction,
  updateBannerAction,
  sendOffDayRequestAction,
} from './actions'

const STATUS_COLORS: Record<string, string> = {
  open:      'bg-green-900/60 text-green-300 border-green-700',
  closed:    'bg-yellow-900/60 text-yellow-300 border-yellow-700',
  awarded:   'bg-blue-900/60 text-blue-300 border-blue-700',
  cancelled: 'bg-gray-800 text-gray-500 border-gray-700',
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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-white">Overtime Management</h1>

      {err && <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded px-3 py-2">{err}</p>}

      {/* OT Banner */}
      <section className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-white font-semibold mb-3">OT Availability Banner</h2>
        <form onSubmit={handleBannerSave} className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-400">Active</label>
            <input
              type="hidden" name="is_active" value={bannerActive ? 'true' : 'false'} />
            <button type="button" onClick={() => setBannerActive(v => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors ${bannerActive ? 'bg-green-600' : 'bg-gray-700'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${bannerActive ? 'left-5' : 'left-0.5'}`} />
            </button>
            <span className={`text-xs ${bannerActive ? 'text-green-400' : 'text-gray-500'}`}>{bannerActive ? 'Visible to drivers' : 'Hidden'}</span>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Message</label>
            <textarea name="message" value={bannerMsg} onChange={e => setBannerMsg(e.target.value)} rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm" />
          </div>
          <button type="submit" disabled={pending}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded disabled:opacity-50">
            Save Banner
          </button>
        </form>
      </section>

      {/* OT Shifts */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold">Overtime Shifts</h2>
          <button onClick={() => setShowPostForm(v => !v)}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs border border-gray-700 rounded">
            {showPostForm ? 'Cancel' : '+ Post Shift'}
          </button>
        </div>

        {showPostForm && (
          <form onSubmit={handlePostShift} className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Date *</label>
                <input name="date" type="date" required className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Start Time *</label>
                <input name="start_time" type="time" required className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Duration (hours) *</label>
                <input name="duration_hours" type="number" step="0.5" min="0.5" required className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Slots Available</label>
                <input name="slots_available" type="number" min="1" defaultValue={1} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Bid Close At</label>
                <input name="bid_close_at" type="datetime-local" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Description</label>
                <input name="description" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" />
              </div>
            </div>
            <button type="submit" disabled={pending}
              className="px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded disabled:opacity-50">
              Post Shift
            </button>
          </form>
        )}

        {shifts.length === 0 ? (
          <p className="text-gray-500 text-sm">No overtime shifts posted.</p>
        ) : (
          <div className="space-y-2">
            {shifts.map(shift => (
              <div key={shift.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-white text-sm font-medium">{shift.date}</span>
                    <span className="text-gray-400 text-xs">{shift.start_time} · {shift.duration_hours}h</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full border ${STATUS_COLORS[shift.status]}`}>{shift.status}</span>
                  </div>
                  {shift.description && <p className="text-gray-500 text-xs">{shift.description}</p>}
                  <p className="text-gray-500 text-xs">{shift.bid_count} bid(s) · {shift.award_count} awarded · {shift.slots_available} slots</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {shift.status === 'open' && (
                    <>
                      <button onClick={() => act(() => closeOtShiftAction(shift.id))} disabled={pending}
                        className="text-xs text-yellow-400 hover:text-yellow-300 disabled:opacity-50">Close</button>
                      <button onClick={() => act(() => awardOtShiftAction(shift.id))} disabled={pending}
                        className="text-xs text-green-400 hover:text-green-300 disabled:opacity-50">Award</button>
                      <button onClick={() => act(() => cancelOtShiftAction(shift.id))} disabled={pending}
                        className="text-xs text-red-500 hover:text-red-400 disabled:opacity-50">Cancel</button>
                    </>
                  )}
                  {shift.status === 'closed' && (
                    <button onClick={() => act(() => awardOtShiftAction(shift.id))} disabled={pending}
                      className="text-xs text-green-400 hover:text-green-300 disabled:opacity-50">Award</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Off-Day Requests */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold">Off-Day Work Requests</h2>
          <button onClick={() => setShowOffDayForm(v => !v)}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs border border-gray-700 rounded">
            {showOffDayForm ? 'Cancel' : '+ Send Request'}
          </button>
        </div>

        {showOffDayForm && (
          <form onSubmit={handleSendOffDay} className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Employee *</label>
                <select name="employee_id" required className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm">
                  <option value="">Select employee</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Date *</label>
                <input name="requested_date" type="date" required className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Message</label>
              <textarea name="message" rows={2} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" />
            </div>
            <button type="submit" disabled={pending}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded disabled:opacity-50">
              Send Request
            </button>
          </form>
        )}

        {offDayRequests.length === 0 ? (
          <p className="text-gray-500 text-sm">No off-day requests sent.</p>
        ) : (
          <div className="space-y-2">
            {offDayRequests.map(req => (
              <div key={req.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex items-start justify-between gap-3">
                <div>
                  <span className="text-white text-sm">{req.employees?.name ?? req.id}</span>
                  <span className="text-gray-500 text-xs ml-2">{req.requested_date}</span>
                  {req.message && <p className="text-gray-400 text-xs mt-0.5">{req.message}</p>}
                  {(req.response === 'accepted' || req.response === 'custom') && (
                    <p className="text-green-300 text-xs mt-1">
                      {req.available_start_time && `From ${req.available_start_time}`}
                      {req.available_hours && ` · ${req.available_hours}h available`}
                      {req.custom_availability && ` · ${req.custom_availability}`}
                    </p>
                  )}
                </div>
                <span className={`flex-shrink-0 px-2 py-0.5 text-xs rounded-full border ${
                  req.response === 'accepted' ? 'bg-green-900/60 text-green-300 border-green-700' :
                  req.response === 'declined' ? 'bg-red-900/60 text-red-300 border-red-700' :
                  req.response === 'custom'   ? 'bg-blue-900/60 text-blue-300 border-blue-700' :
                  'bg-gray-800 text-gray-400 border-gray-700'
                }`}>{req.response}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
