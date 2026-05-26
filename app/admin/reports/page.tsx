import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import AdminReportsClient from './reports-client'

export default async function AdminReportsPage() {
  const { user } = await getServerUser()
  if (!user) redirect('/login')

  const supabase = await createSupabaseServerClient()

  const [
    { data: timeEntries },
    { data: otAwardsRaw },
    { data: formsRaw },
    { data: safetyRaw },
    { data: bidAwardsRaw },
    { data: signinCounts },
  ] = await Promise.all([
    supabase
      .from('time_entries')
      .select('employees(name), date, clock_in_time, clock_out_time, total_hours')
      .order('date', { ascending: false })
      .limit(500),
    supabase
      .from('overtime_awards')
      .select('employees(name), overtime_shifts(date, duration_hours), award_method')
      .limit(500),
    supabase
      .from('form_submissions')
      .select('employees(name), form_type, status, submitted_at')
      .order('submitted_at', { ascending: false })
      .limit(500),
    supabase
      .from('safety_meetings')
      .select('title, department, scheduled_date')
      .order('scheduled_date', { ascending: false })
      .limit(200),
    supabase
      .from('shift_bid_awards')
      .select('employees(name), shift_bid_slots(bid_number), shift_bid_cycles(name), preference_rank, award_method')
      .limit(500),
    supabase
      .from('safety_meeting_signins')
      .select('meeting_id'),
  ])

  // Count sign-ins per meeting
  const signinMap: Record<string, number> = {}
  ;(signinCounts ?? []).forEach((s: any) => {
    signinMap[s.meeting_id] = (signinMap[s.meeting_id] ?? 0) + 1
  })

  const hoursData = (timeEntries ?? []).map((r: any) => ({
    name:        r.employees?.name ?? '—',
    date:        r.date,
    clock_in:    r.clock_in_time ? new Date(r.clock_in_time).toLocaleTimeString() : '—',
    clock_out:   r.clock_out_time ? new Date(r.clock_out_time).toLocaleTimeString() : '—',
    total_hours: r.total_hours ?? '—',
  }))

  const otAwards = (otAwardsRaw ?? []).map((r: any) => ({
    employee_name:  r.employees?.name ?? '—',
    date:           (r.overtime_shifts as any)?.date ?? '—',
    duration_hours: (r.overtime_shifts as any)?.duration_hours ?? '—',
    award_method:   r.award_method,
  }))

  const forms = (formsRaw ?? []).map((r: any) => ({
    employee_name: r.employees?.name ?? '—',
    form_type:     r.form_type,
    status:        r.status,
    submitted_at:  new Date(r.submitted_at).toLocaleDateString(),
  }))

  const safetyMeetings = (safetyRaw ?? []).map((m: any) => ({
    title:          m.title,
    department:     m.department,
    scheduled_date: m.scheduled_date,
    signin_count:   signinMap[m.id] ?? 0,
  }))

  const bidAwards = (bidAwardsRaw ?? []).map((r: any) => ({
    cycle_name:      (r.shift_bid_cycles as any)?.name ?? '—',
    employee_name:   r.employees?.name ?? '—',
    slot_bid_number: (r.shift_bid_slots as any)?.bid_number ?? '—',
    preference_rank: r.preference_rank ?? '—',
    award_method:    r.award_method,
  }))

  return (
    <AdminReportsClient
      hoursData={hoursData}
      otAwards={otAwards}
      forms={forms}
      safetyMeetings={safetyMeetings}
      bidAwards={bidAwards}
    />
  )
}
