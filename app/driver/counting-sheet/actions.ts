'use server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function submitCountingSheetAction(sheetId: string, driverName: string) {
  const admin = createSupabaseAdmin()
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
