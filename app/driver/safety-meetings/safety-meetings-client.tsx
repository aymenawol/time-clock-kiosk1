'use client'
import { useTransition, useState } from 'react'
import { SafetyMeetingV3 } from '@/lib/supabase'
import { signInToMeetingAction } from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Check } from 'lucide-react'

const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  scheduled: 'info',
  completed: 'ok',
  cancelled: 'neutral',
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Safety Meetings</h1>

      {err && <p className="text-danger text-sm bg-danger-surface border border-danger-border rounded-lg px-3 py-2">{err}</p>}

      <section>
        <h2 className="text-foreground font-semibold mb-3">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="text-muted-foreground text-sm">No upcoming meetings.</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map(m => (
              <Card key={m.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-foreground font-medium">{m.title}</p>
                      <p className="text-muted-foreground text-sm">{DEPT_LABELS[m.department]} · {m.scheduled_date} at {m.scheduled_time}</p>
                      {m.location && <p className="text-muted-foreground text-xs mt-0.5">{m.location}</p>}
                      {m.notes    && <p className="text-muted-foreground text-xs mt-0.5">{m.notes}</p>}
                    </div>
                    <div className="shrink-0">
                      {m.my_signin ? (
                        <span className="text-ok text-xs font-medium flex items-center gap-1">
                          <Check className="size-3.5" /> {m.my_signin.attendance_status}
                        </span>
                      ) : (
                        <Button onClick={() => handleSignIn(m.id)} disabled={pending} size="sm">
                          Sign In
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="text-foreground font-semibold mb-3">Past Meetings</h2>
          <div className="space-y-2">
            {past.map(m => (
              <Card key={m.id}>
                <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-foreground text-sm">{m.title}</p>
                    <p className="text-muted-foreground text-xs">{m.scheduled_date} · {DEPT_LABELS[m.department]}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={STATUS_VARIANT[m.status] ?? 'neutral'}>{m.status}</Badge>
                    {m.my_signin && (
                      <span className="text-muted-foreground text-xs capitalize">{m.my_signin.attendance_status}</span>
                    )}
                    {!m.my_signin && m.status === 'completed' && (
                      <span className="text-danger text-xs">absent</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
