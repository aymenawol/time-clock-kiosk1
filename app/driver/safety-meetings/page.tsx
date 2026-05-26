import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import DriverSafetyMeetingsClient from './safety-meetings-client'

export default async function DriverSafetyMeetingsPage() {
  const { user } = await getServerUser()
  if (!user) redirect('/')

  const supabase = await createSupabaseServerClient()

  const { data: emp } = await supabase
    .from('employees')
    .select('id, department')
    .eq('auth_user_id', user.id)
    .single()

  const employeeId = emp?.id ?? null

  // Load meetings relevant to this driver's department (or 'all')
  const { data: meetings } = await supabase
    .from('safety_meetings')
    .select('*')
    .order('scheduled_date', { ascending: false })
    .limit(50)

  const { data: mySignins } = employeeId
    ? await supabase
        .from('safety_meeting_signins')
        .select('meeting_id, attendance_status')
        .eq('employee_id', employeeId)
    : { data: [] }

  const signinMap: Record<string, { attendance_status: string }> = {}
  ;(mySignins ?? []).forEach((s: any) => {
    signinMap[s.meeting_id] = { attendance_status: s.attendance_status }
  })

  const meetingsWithSignin = (meetings ?? []).map((m: any) => ({
    ...m,
    my_signin: signinMap[m.id] ?? null,
  }))

  return <DriverSafetyMeetingsClient meetings={meetingsWithSignin as any} />
}
