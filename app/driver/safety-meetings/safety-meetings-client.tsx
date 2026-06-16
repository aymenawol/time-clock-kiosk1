'use client'
import { useTransition, useState } from 'react'
import { SafetyMeetingV3 } from '@/lib/supabase'
import { signInToMeetingAction } from './actions'

const STATUS_COLOR: Record<string, string> = {
  scheduled: 'bg-blue-900/60 text-blue-300 border-blue-700',
  completed: 'bg-green-900/60 text-green-300 border-green-700',
  cancelled: 'bg-muted text-muted-foreground border-border',
}

const DEPT_LABELS: Record<string, string> = {
  drivers:      'Drivers',
  coordinators: 'Coordinators',
  technicians:  'Technicians',
  fueler_washer:'Fueler / Washer',
  all:          'All Staff',
}

interface MeetingWithSignin extends SafetyMeetingV3 {
  my_signin: { attendance_status: string } | null
}

interface Props {
  meetings: MeetingWithSignin[]
}

export default function DriverSafetyMeetingsClient({ meetings }: Props) {
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  function handleSignIn(meetingId: string) {
    setErr(null)
    startTransition(async () => {
      try { await signInToMeetingAction(meetingId) }
      catch (e: any) { setErr(e.message) }
    })
  }

  const upcoming = meetings.filter(m => m.status === 'scheduled')
  const past     = meetings.filter(m => m.status !== 'scheduled')

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Safety Meetings</h1>

      {err && <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded px-3 py-2">{err}</p>}

      <section>
        <h2 className="text-foreground font-semibold mb-3">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="text-muted-foreground text-sm">No upcoming meetings.</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map(m => (
              <div key={m.id} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-foreground font-medium">{m.title}</p>
                    <p className="text-muted-foreground text-sm">{DEPT_LABELS[m.department]} · {m.scheduled_date} at {m.scheduled_time}</p>
                    {m.location && <p className="text-muted-foreground text-xs mt-0.5">{m.location}</p>}
                    {m.notes    && <p className="text-muted-foreground text-xs mt-0.5">{m.notes}</p>}
                  </div>
                  <div className="shrink-0">
                    {m.my_signin ? (
                      <span className="text-green-400 text-xs font-medium">
                        ✓ {m.my_signin.attendance_status}
                      </span>
                    ) : (
                      <button onClick={() => handleSignIn(m.id)} disabled={pending}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-foreground text-xs rounded disabled:opacity-50">
                        Sign In
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="text-foreground font-semibold mb-3">Past Meetings</h2>
          <div className="space-y-2">
            {past.map(m => (
              <div key={m.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-foreground text-sm">{m.title}</p>
                  <p className="text-muted-foreground text-xs">{m.scheduled_date} · {DEPT_LABELS[m.department]}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_COLOR[m.status]}`}>{m.status}</span>
                  {m.my_signin && (
                    <span className="text-muted-foreground text-xs capitalize">{m.my_signin.attendance_status}</span>
                  )}
                  {!m.my_signin && m.status === 'completed' && (
                    <span className="text-red-500 text-xs">absent</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
