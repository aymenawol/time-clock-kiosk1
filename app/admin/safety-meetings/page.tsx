import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import AdminSafetyMeetingsClient from './safety-meetings-client'

export default async function AdminSafetyMeetingsPage() {
  const { user } = await getServerUser()
  if (!user) redirect('/login')

  const supabase = await createSupabaseServerClient()

  const [{ data: meetings }, { data: signins }] = await Promise.all([
    supabase.from('safety_meetings').select('*').order('scheduled_date', { ascending: false }),
    // Project to only the fields the client renders — avoids hauling every signin
    // column (signature/device payloads) across all meetings.
    supabase.from('safety_meeting_signins').select('id, meeting_id, signed_in_at, employees(name)'),
  ])

  const signinsByMeeting: Record<string, any[]> = {}
  ;(signins ?? []).forEach((s: any) => {
    if (!signinsByMeeting[s.meeting_id]) signinsByMeeting[s.meeting_id] = []
    signinsByMeeting[s.meeting_id].push(s)
  })

  const meetingsWithCount = (meetings ?? []).map((m: any) => ({
    ...m,
    signin_count: (signinsByMeeting[m.id] ?? []).length,
  }))

  return (
    <AdminSafetyMeetingsClient
      meetings={meetingsWithCount as any}
      signinsByMeeting={signinsByMeeting}
    />
  )
}
