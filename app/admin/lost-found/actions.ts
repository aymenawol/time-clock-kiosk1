'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getServerUser } from '@/lib/supabase-server'

async function assertStaff() {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')
  const role = user.app_metadata?.role as string
  if (!['admin', 'management', 'dispatcher', 'supervisor', 'coordinator'].includes(role)) throw new Error('No access')
  return { user, role }
}

export type LostItemStatus = 'found' | 'collected' | 'returned_to_dispatch' | 'claimed' | 'disposed'

export async function transitionLostItemAction(
  itemId: string,
  newStatus: LostItemStatus,
  data: {
    collectedBy?:      string
    claimantName?:     string
    claimantId?:       string
    disposalReason?:   string
    notes?:            string
  } = {}
) {
  const { user } = await assertStaff()
  const admin = createSupabaseAdmin()

  const { data: emp } = await admin.from('employees').select('id').eq('auth_user_id', user.id).single()
  if (!emp) return { error: 'Employee not found' }

  const now = new Date().toISOString()
  const update: Record<string, unknown> = { status: newStatus }

  if (newStatus === 'collected') {
    update.collected_by = data.collectedBy ?? emp.id
    update.collected_at = now
  } else if (newStatus === 'returned_to_dispatch') {
    update.returned_to_dispatch_at = now
  } else if (newStatus === 'claimed') {
    update.claimed_at     = now
    update.claimant_name  = data.claimantName
    update.claimant_id    = data.claimantId ?? null
  } else if (newStatus === 'disposed') {
    update.disposed_at     = now
    update.disposal_reason = data.disposalReason ?? ''
  }

  const { error } = await admin.from('lost_items').update(update).eq('id', itemId)
  if (error) return { error: error.message }

  revalidatePath('/admin/lost-found')
  return { success: true }
}
