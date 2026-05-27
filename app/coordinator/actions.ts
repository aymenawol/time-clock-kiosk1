'use server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'

/**
 * Save coordinator notes onto a shift record.
 * Uses the service-role client so the coordinator role's RLS
 * doesn't need UPDATE permission on the shifts table.
 */
export async function saveShiftNotesAction(shiftId: string, notes: string) {
  const supabase = createSupabaseAdmin()
  const { error } = await supabase
    .from('shifts')
    .update({ notes: notes.trim() || null })
    .eq('id', shiftId)
  if (error) throw new Error(error.message)
}
