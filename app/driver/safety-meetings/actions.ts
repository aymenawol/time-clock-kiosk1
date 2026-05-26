'use server'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'

export async function signInToMeetingAction(meetingId: string) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createSupabaseServerClient()

  const { data: emp } = await supabase
    .from('employees')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()
  if (!emp) throw new Error('Employee not found')

  const { error } = await supabase.from('safety_meeting_signins').upsert({
    meeting_id:        meetingId,
    employee_id:       emp.id,
    attendance_status: 'present',
    added_by_admin:    false,
  }, { onConflict: 'meeting_id,employee_id' })

  if (error) throw new Error(error.message)
  revalidatePath('/driver/safety-meetings')
}
