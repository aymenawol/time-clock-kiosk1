'use server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/auth/rbac'

const STAFF_ROLES = ['admin', 'management', 'dispatcher', 'supervisor', 'coordinator']

export async function submitCountingSheetAction(sheetId: string, driverName: string) {
  const auth = await requireUser()
  if (!auth.ok) return { error: auth.error }

  const admin = createSupabaseAdmin()

  // Authorization: a driver may only submit their OWN sheet; staff may submit any.
  const { data: sheet } = await admin
    .from('counting_sheets')
    .select('driver_id')
    .eq('id', sheetId)
    .single()
  if (!sheet) return { error: 'Counting sheet not found.' }

  if (!STAFF_ROLES.includes(auth.role ?? '')) {
    const { data: me } = await admin
      .from('employees')
      .select('id')
      .eq('auth_user_id', auth.user.id)
      .maybeSingle()
    if (!me || me.id !== sheet.driver_id) {
      return { error: 'You can only submit your own counting sheet.' }
    }
  }

  const now = new Date().toISOString()

  // Mark sheet as submitted
  const { error } = await admin
    .from('counting_sheets')
    .update({ status: 'submitted', submitted_at: now, end_time: now })
    .eq('id', sheetId)

  if (error) return { error: error.message }

  // Notify management/admin/dispatcher
  const { data: recipients } = await admin
    .from('employees')
    .select('id')
    .in('role', ['admin', 'management', 'dispatcher'])
    .eq('status', 'active')

  if (recipients && recipients.length > 0) {
    await admin.from('notification_queue').insert(
      recipients.map((r: { id: string }) => ({
        recipient_id: r.id,
        event_type:   'counting_sheet_submitted',
        channel:      'in_app',
        payload: {
          message:  `${driverName} submitted a counting sheet`,
          sheet_id: sheetId,
        },
      }))
    )
  }

  return { error: null }
}
