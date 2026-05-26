'use server'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function reviewFormAction(
  submissionId: string,
  status: 'approved' | 'denied' | 'returned',
  comments: string
) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('form_submissions')
    .update({
      status,
      reviewed_by:      user.id,
      reviewed_at:      new Date().toISOString(),
      reviewer_comments: comments || null,
    })
    .eq('id', submissionId)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/forms')
  revalidatePath(`/admin/forms/${submissionId}`)
}

export async function approveResignationAction(submissionId: string, comments: string) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createSupabaseServerClient()

  // Fetch submission to get employee_id
  const { data: sub } = await supabase
    .from('form_submissions')
    .select('employee_id')
    .eq('id', submissionId)
    .single()
  if (!sub) throw new Error('Submission not found')

  // Get employee's auth_user_id
  const { data: emp } = await supabase
    .from('employees')
    .select('auth_user_id')
    .eq('id', sub.employee_id)
    .single()

  // Update form status
  await supabase.from('form_submissions').update({
    status:           'approved',
    reviewed_by:      user.id,
    reviewed_at:      new Date().toISOString(),
    reviewer_comments: comments || null,
  }).eq('id', submissionId)

  // Deactivate employee record
  await supabase.from('employees').update({ status: 'terminated', is_active: false }).eq('id', sub.employee_id)

  // Remove active shift assignments
  await supabase.from('shifts').update({ status: 'cancelled' }).eq('employee_id', sub.employee_id).eq('status', 'scheduled')

  // Ban auth user if we have auth_user_id
  if (emp?.auth_user_id) {
    try {
      const admin = createSupabaseAdmin()
      await admin.auth.admin.updateUserById(emp.auth_user_id, { ban_duration: '87600h' }) // 10 years
    } catch {
      // Non-fatal: still complete the resignation
    }
  }

  // Notify payroll role (best effort)
  try {
    const { data: payrollUsers } = await supabase
      .from('employees')
      .select('auth_user_id')
      .eq('role', 'payroll')
      .eq('is_active', true)
    ;(payrollUsers ?? []).forEach(async (p: any) => {
      if (p.auth_user_id) {
        await supabase.from('notifications').insert({
          user_id: p.auth_user_id,
          type: 'resignation_approved',
          title: 'Resignation Approved',
          body: `Employee resignation has been approved. Please process final pay.`,
          data: { submission_id: submissionId, employee_id: sub.employee_id },
        })
      }
    })
  } catch { /* non-fatal */ }

  revalidatePath('/admin/forms')
  revalidatePath(`/admin/forms/${submissionId}`)
}
