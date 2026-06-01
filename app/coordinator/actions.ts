'use server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requireRole } from '@/lib/auth/rbac'

/**
 * Save coordinator notes onto a shift record.
 * Uses the service-role client so the coordinator role's RLS
 * doesn't need UPDATE permission on the shifts table — therefore it MUST
 * authorize the caller itself.
 */
export async function saveShiftNotesAction(shiftId: string, notes: string): Promise<{ error?: string }> {
  const auth = await requireRole('coordinator', 'supervisor', 'admin', 'management')
  if (!auth.ok) return { error: auth.error }

  const supabase = createSupabaseAdmin()
  const { error } = await supabase
    .from('shifts')
    .update({ notes: notes.trim() || null })
    .eq('id', shiftId)
  if (error) return { error: error.message }
  return {}
}
