'use server'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import { SafetyMeetingDept } from '@/lib/supabase'

export async function createMeetingAction(formData: FormData) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('safety_meetings').insert({
    title:          formData.get('title') as string,
    department:     formData.get('department') as SafetyMeetingDept,
    scheduled_date: formData.get('scheduled_date') as string,
    scheduled_time: formData.get('scheduled_time') as string,
    location:       (formData.get('location') as string) || null,
    notes:          (formData.get('notes') as string) || null,
    created_by:     user.id,
    status:         'scheduled',
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/safety-meetings')
}

export async function completeMeetingAction(meetingId: string) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('safety_meetings').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
  }).eq('id', meetingId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/safety-meetings')
}

export async function cancelMeetingAction(meetingId: string) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('safety_meetings').update({ status: 'cancelled' }).eq('id', meetingId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/safety-meetings')
}

export async function adminSignInEmployeeAction(meetingId: string, employeeId: string, note: string) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('safety_meeting_signins').upsert({
    meeting_id:       meetingId,
    employee_id:      employeeId,
    attendance_status: 'present',
    added_by_admin:   true,
    admin_note:       note || null,
  }, { onConflict: 'meeting_id,employee_id' })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/safety-meetings')
}
