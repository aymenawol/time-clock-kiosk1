'use server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requireRole } from '@/lib/auth/rbac'

/**
 * Dispatcher re-enables a missed/overrun break so the driver can take it.
 * Reopens the break window starting now (+ flex) and records the override.
 */
export async function reEnableBreakAction(breakId: string): Promise<{ error?: string }> {
  const auth = await requireRole('dispatcher', 'admin', 'management')
  if (!auth.ok) return { error: auth.error }

  const admin = createSupabaseAdmin()

  // Flex window length comes from settings (default 45 min).
  const { data: settings } = await admin
    .from('app_settings')
    .select('break_rules')
    .eq('id', 'singleton')
    .single()
  const flexMin = Number((settings?.break_rules as Record<string, unknown> | null)?.flex_minutes ?? 45)

  const now = new Date()
  const { error } = await admin
    .from('breaks')
    .update({
      status:                 'pending',
      actual_start:           null,
      actual_end:             null,
      window_open:            now.toISOString(),
      window_close:           new Date(now.getTime() + flexMin * 60_000).toISOString(),
      sms_reminder_sent:      false,
      overrun_alert_sent:     false,
      dispatcher_override_by: auth.user.id,
      dispatcher_override_at: now.toISOString(),
    })
    .eq('id', breakId)

  if (error) return { error: error.message }
  return {}
}
