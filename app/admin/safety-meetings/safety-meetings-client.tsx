'use client'
import { useTransition, useState } from 'react'
import { Plus, Download } from 'lucide-react'
import { SafetyMeetingV3, SafetyMeetingDept } from '@/lib/supabase'
import { createMeetingAction, completeMeetingAction, cancelMeetingAction } from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const DEPT_LABELS: Record<SafetyMeetingDept, string> = {
  drivers:      'Drivers',
  coordinators: 'Coordinators',
  technicians:  'Technicians',
  fueler_washer:'Fueler / Washer',
  all:          'All Staff',
}

const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  scheduled: 'info',
  completed: 'ok',
  cancelled: 'neutral',
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

  const selectClass =
    'h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">Safety Meetings</h1>
        <Button variant="secondary" size="sm" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : <><Plus className="size-4" /> Schedule Meeting</>}
        </Button>
      </div>

      {err && <p className="text-danger text-sm rounded-lg border border-danger-border bg-danger-surface px-3 py-2">{err}</p>}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New Safety Meeting</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="sm-title">Title *</Label>
                  <Input id="sm-title" name="title" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sm-dept">Department *</Label>
                  <select id="sm-dept" name="department" required className={selectClass}>
                    {(Object.entries(DEPT_LABELS) as [SafetyMeetingDept, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sm-date">Date *</Label>
                  <Input id="sm-date" name="scheduled_date" type="date" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sm-time">Time *</Label>
                  <Input id="sm-time" name="scheduled_time" type="time" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sm-location">Location</Label>
                  <Input id="sm-location" name="location" />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="sm-notes">Notes</Label>
                  <Textarea id="sm-notes" name="notes" rows={2} />
                </div>
              </div>
              <Button type="submit" size="sm" disabled={pending}>
                Schedule Meeting
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {meetings.length === 0 ? (
        <p className="text-muted-foreground text-sm">No meetings scheduled.</p>
      ) : (
        <div className="space-y-3">
          {meetings.map(m => {
            const signins = signinsByMeeting[m.id] ?? []
            const isExpanded = expanded === m.id
            return (
              <Card key={m.id}>
                <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <h2 className="text-foreground font-medium">{m.title}</h2>
                      <Badge variant={STATUS_VARIANT[m.status]}>{m.status}</Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {DEPT_LABELS[m.department]} · {m.scheduled_date} {m.scheduled_time}
                      {m.location && <> · {m.location}</>}
                    </p>
                    <p className="text-muted-foreground text-xs mt-0.5">{signins.length} sign-in{signins.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => setExpanded(isExpanded ? null : m.id)}>
                      {isExpanded ? 'Collapse' : 'Sign-ins'}
                    </Button>
                    {m.status === 'scheduled' && (
                      <Button variant="ghost" size="sm" className="text-ok hover:text-ok"
                        onClick={() => act(() => completeMeetingAction(m.id))} disabled={pending}>Complete</Button>
                    )}
                    {m.status === 'scheduled' && (
                      <Button variant="ghost" size="sm" className="text-danger hover:text-danger"
                        onClick={() => act(() => cancelMeetingAction(m.id))} disabled={pending}>Cancel</Button>
                    )}
                    {signins.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => downloadCsv(m, signins)}>
                        <Download className="size-4" /> CSV
                      </Button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3">
                    {signins.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No sign-ins yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-muted-foreground text-xs border-b border-border">
                              <th className="text-left py-1.5 pr-4">Name</th>
                              <th className="text-left py-1.5 pr-4">Status</th>
                              <th className="text-left py-1.5">Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {signins.map(s => (
                              <tr key={s.id} className="border-b border-border/50">
                                <td className="py-1.5 pr-4 text-foreground">{s.employees?.name ?? s.id}</td>
                                <td className="py-1.5 pr-4 text-muted-foreground capitalize">{s.attendance_status}</td>
                                <td className="py-1.5 text-muted-foreground text-xs">{new Date(s.signed_in_at).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
