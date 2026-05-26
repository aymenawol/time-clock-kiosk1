'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getServerUser } from '@/lib/supabase-server'

export async function resolveAlertAction(alertId: string, notes: string) {
  const { user } = await getServerUser()
  if (!user) return { error: 'Unauthorized' }

  const role = user.app_metadata?.role as string
  if (!['admin', 'management', 'supervisor'].includes(role)) return { error: 'Insufficient permissions' }

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('fatigue_alerts')
    .update({ resolved_by: user.id, resolved_at: new Date().toISOString(), notes })
    .eq('id', alertId)

  if (error) return { error: error.message }
  revalidatePath('/admin/fatigue')
  return { success: true }
}

export async function dismissAlertAction(alertId: string, reason: string) {
  const { user } = await getServerUser()
  if (!user) return { error: 'Unauthorized' }

  const role = user.app_metadata?.role as string
  if (!['admin', 'management', 'dispatcher'].includes(role)) return { error: 'Insufficient permissions' }

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('fatigue_alerts')
    .update({ dismissed_by: user.id, dismissed_at: new Date().toISOString(), dismiss_reason: reason })
    .eq('id', alertId)

  if (error) return { error: error.message }
  revalidatePath('/admin/fatigue')
  return { success: true }
}
