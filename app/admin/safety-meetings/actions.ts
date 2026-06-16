'use server'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { enqueueNotificationBatch } from '@/lib/notifications'
import { SafetyMeetingDept } from '@/lib/supabase'

// N8 — department → roles to notify when a safety meeting is scheduled.
const DEPT_ROLES: Record<SafetyMeetingDept, string[] | null> = {
  drivers:        ['driver'],
  coordinators:   ['coordinator', 'supervisor'],
  technicians:    ['technician'],
  fueler_washer:  ['fueler_washer'],
  all:            null, // null → all active employees
}

export async function createMeetingAction(formData: FormData) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')
  if (!['admin', 'management'].includes((user.app_metadata?.role as string) ?? '')) throw new Error('Forbidden')

  const supabase = await createSupabaseServerClient()
  const department = formData.get('department') as SafetyMeetingDept
  const title = formData.get('title') as string
  const scheduledDate = formData.get('scheduled_date') as string
  const scheduledTime = formData.get('scheduled_time') as string
  const { error } = await supabase.from('safety_meetings').insert({
    title,
    department,
    scheduled_date: scheduledDate,
    scheduled_time: scheduledTime,
    location:       (formData.get('location') as string) || null,
    notes:          (formData.get('notes') as string) || null,
    created_by:     user.id,
    status:         'scheduled',
  })
  if (error) throw new Error(error.message)

  // N8 — notify the relevant employees that a meeting was scheduled.
  const admin = createSupabaseAdmin()
  let q = admin.from('employees').select('id').eq('status', 'active').not('auth_user_id', 'is', null)
  const roles = DEPT_ROLES[department]
  if (roles) q = q.in('role', roles)
  const { data: recipients } = await q
  if (recipients?.length) {
    await enqueueNotificationBatch(
      recipients.map((e: { id: string }) => ({
        recipientId: e.id,
        eventType: 'safety_meeting',
        channels: ['in_app' as const],
        payload: {
          title: 'Safety meeting scheduled',
          message: `${title} — ${scheduledDate}${scheduledTime ? ` at ${scheduledTime}` : ''}.`,
        },
      }))
    )
  }

  revalidatePath('/admin/safety-meetings')
}

export async function completeMeetingAction(meetingId: string) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')
  if (!['admin', 'management'].includes((user.app_metadata?.role as string) ?? '')) throw new Error('Forbidden')

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
  if (!['admin', 'management'].includes((user.app_metadata?.role as string) ?? '')) throw new Error('Forbidden')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('safety_meetings').update({ status: 'cancelled' }).eq('id', meetingId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/safety-meetings')
}

export async function adminSignInEmployeeAction(meetingId: string, employeeId: string, note: string) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')
  if (!['admin', 'management'].includes((user.app_metadata?.role as string) ?? '')) throw new Error('Forbidden')

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
