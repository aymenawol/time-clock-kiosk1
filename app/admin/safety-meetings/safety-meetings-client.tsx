'use client'
import { useTransition, useState } from 'react'
import { SafetyMeetingV3, SafetyMeetingDept } from '@/lib/supabase'
import { createMeetingAction, completeMeetingAction, cancelMeetingAction } from './actions'

const DEPT_LABELS: Record<SafetyMeetingDept, string> = {
  drivers:      'Drivers',
  coordinators: 'Coordinators',
  technicians:  'Technicians',
  fueler_washer:'Fueler / Washer',
  all:          'All Staff',
}

const STATUS_COLOR: Record<string, string> = {
  scheduled:  'bg-blue-900/60 text-blue-300 border-blue-700',
  completed:  'bg-green-900/60 text-green-300 border-green-700',
  cancelled:  'bg-gray-800 text-gray-500 border-gray-700',
}

interface SigninRow { id: string; employees: { name: string } | null; signed_in_at: string; attendance_status: string }

interface Props {
  meetings: (SafetyMeetingV3 & { signin_count: number })[]
  signinsByMeeting: Record<string, SigninRow[]>
}

export default function AdminSafetyMeetingsClient({ meetings, signinsByMeeting }: Props) {
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  function act(fn: () => Promise<void>) {
    setErr(null)
    startTransition(async () => { try { await fn() } catch (e: any) { setErr(e.message) } })
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    act(async () => { await createMeetingAction(fd); setShowForm(false) })
  }

  function downloadCsv(meeting: SafetyMeetingV3, signins: SigninRow[]) {
    const rows = [
      ['Name', 'Status', 'Signed In At'],
      ...signins.map(s => [
        s.employees?.name ?? s.id,
        s.attendance_status,
        new Date(s.signed_in_at).toLocaleString(),
      ])
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `safety-meeting-${meeting.scheduled_date}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Safety Meetings</h1>
        <button onClick={() => setShowForm(v => !v)}
          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-sm border border-gray-700 rounded">
          {showForm ? 'Cancel' : '+ Schedule Meeting'}
        </button>
      </div>

      {err && <p className="text-red-400 text-sm mb-4 bg-red-900/20 border border-red-800 rounded px-3 py-2">{err}</p>}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-6 space-y-3">
          <h2 className="text-sm font-semibold text-white">New Safety Meeting</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Title *</label>
              <input name="title" required className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Department *</label>
              <select name="department" required className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm">
                {(Object.entries(DEPT_LABELS) as [SafetyMeetingDept, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Date *</label>
              <input name="scheduled_date" type="date" required className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Time *</label>
              <input name="scheduled_time" type="time" required className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Location</label>
              <input name="location" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Notes</label>
              <textarea name="notes" rows={2} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" />
            </div>
          </div>
          <button type="submit" disabled={pending}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded disabled:opacity-50">
            Schedule Meeting
          </button>
        </form>
      )}

      {meetings.length === 0 ? (
        <p className="text-gray-500 text-sm">No meetings scheduled.</p>
      ) : (
        <div className="space-y-3">
          {meetings.map(m => {
            const signins = signinsByMeeting[m.id] ?? []
            const isExpanded = expanded === m.id
            return (
              <div key={m.id} className="bg-gray-900 border border-gray-800 rounded-lg">
                <div className="p-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h2 className="text-white font-medium">{m.title}</h2>
                      <span className={`px-2 py-0.5 text-xs rounded-full border ${STATUS_COLOR[m.status]}`}>{m.status}</span>
                    </div>
                    <p className="text-gray-400 text-xs">
                      {DEPT_LABELS[m.department]} · {m.scheduled_date} {m.scheduled_time}
                      {m.location && <> · {m.location}</>}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">{signins.length} sign-in{signins.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setExpanded(isExpanded ? null : m.id)}
                      className="text-xs text-gray-400 hover:text-white">
                      {isExpanded ? 'Collapse' : 'Sign-ins'}
                    </button>
                    {m.status === 'scheduled' && (
                      <button onClick={() => act(() => completeMeetingAction(m.id))} disabled={pending}
                        className="text-xs text-green-400 hover:text-green-300 disabled:opacity-50">Complete</button>
                    )}
                    {m.status === 'scheduled' && (
                      <button onClick={() => act(() => cancelMeetingAction(m.id))} disabled={pending}
                        className="text-xs text-red-500 hover:text-red-400 disabled:opacity-50">Cancel</button>
                    )}
                    {signins.length > 0 && (
                      <button onClick={() => downloadCsv(m, signins)}
                        className="text-xs text-blue-400 hover:text-blue-300">CSV</button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-800 px-4 pb-4 pt-3">
                    {signins.length === 0 ? (
                      <p className="text-gray-500 text-sm">No sign-ins yet.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-500 text-xs border-b border-gray-800">
                            <th className="text-left py-1.5 pr-4">Name</th>
                            <th className="text-left py-1.5 pr-4">Status</th>
                            <th className="text-left py-1.5">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {signins.map(s => (
                            <tr key={s.id} className="border-b border-gray-800/50">
                              <td className="py-1.5 pr-4 text-white">{s.employees?.name ?? s.id}</td>
                              <td className="py-1.5 pr-4 text-gray-400 capitalize">{s.attendance_status}</td>
                              <td className="py-1.5 text-gray-500 text-xs">{new Date(s.signed_in_at).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
