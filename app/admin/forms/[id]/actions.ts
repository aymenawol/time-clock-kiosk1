'use server'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requireRole } from '@/lib/auth/rbac'

export async function reviewFormAction(
  submissionId: string,
  status: 'approved' | 'denied' | 'returned',
  comments: string
) {
  // Only management/admin may decide on forms. Without this guard, the
  // forms_own_update_returned RLS policy lets an employee self-approve a
  // form that was returned to them.
  const auth = await requireRole('admin', 'management')
  if (!auth.ok) throw new Error(auth.error)

  const supabase = await createSupabaseServerClient()
  const { data: updated, error } = await supabase
    .from('form_submissions')
    .update({
      status,
      reviewed_by:      auth.user.id,
      reviewed_at:      new Date().toISOString(),
      reviewer_comments: comments || null,
    })
    .eq('id', submissionId)
    .select('employee_id, form_type')
    .single()

  if (error) throw new Error(error.message)

  // Notify the submitter (in-app via queue→trigger; email via processor).
  if (updated?.employee_id) {
    const eventType = status === 'approved' ? 'form_approved'
      : status === 'denied' ? 'form_denied' : 'form_returned'
    const label = String(updated.form_type ?? 'form').replace(/_/g, ' ')
    const admin = createSupabaseAdmin()
    await admin.from('notification_queue').insert({
      recipient_id: updated.employee_id,
      event_type:   eventType,
      channel:      'in_app',
      payload: {
        title:   `Form ${status}`,
        message: `Your ${label} request was ${status}.${comments ? ` Note: ${comments}` : ''}`,
        submission_id: submissionId,
      },
    })
  }

  revalidatePath('/admin/forms')
  revalidatePath(`/admin/forms/${submissionId}`)
}

export async function approveResignationAction(submissionId: string, comments: string) {
  const auth = await requireRole('admin', 'management')
  if (!auth.ok) throw new Error(auth.error)

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
    reviewed_by:      auth.user.id,
    reviewed_at:      new Date().toISOString(),
    reviewer_comments: comments || null,
  }).eq('id', submissionId)

  // Deactivate employee record
  await supabase.from('employees').update({ status: 'terminated', is_active: false }).eq('id', sub.employee_id)

  // Remove pending/active shift assignments
  await supabase.from('shifts').update({ status: 'cancelled' })
    .eq('employee_id', sub.employee_id)
    .in('status', ['scheduled', 'active'])

  // Ban auth user if we have auth_user_id
  if (emp?.auth_user_id) {
    try {
      const admin = createSupabaseAdmin()
      await admin.auth.admin.updateUserById(emp.auth_user_id, { ban_duration: '87600h' }) // 10 years
    } catch {
      // Non-fatal: still complete the resignation
    }
  }

  // Notify payroll role (best effort, awaited)
  try {
    const { data: payrollUsers } = await supabase
      .from('employees')
      .select('auth_user_id')
      .eq('role', 'payroll')
      .eq('is_active', true)
    const rows = (payrollUsers ?? [])
      .filter((p: { auth_user_id: string | null }) => !!p.auth_user_id)
      .map((p: { auth_user_id: string }) => ({
        user_id: p.auth_user_id,
        type: 'resignation_approved',
        title: 'Resignation Approved',
        body: 'Employee resignation has been approved. Please process final pay.',
        data: { submission_id: submissionId, employee_id: sub.employee_id },
      }))
    if (rows.length > 0) {
      await supabase.from('notifications').insert(rows)
    }
  } catch { /* non-fatal */ }

  revalidatePath('/admin/forms')
  revalidatePath(`/admin/forms/${submissionId}`)
}
