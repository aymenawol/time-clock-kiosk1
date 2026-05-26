'use server'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'

export async function submitBidAction(
  cycleId: string,
  preferences: { slot_id: string; rank: 1 | 2 | 3 }[]
) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createSupabaseServerClient()

  // Resolve employee_id
  const { data: emp } = await supabase
    .from('employees')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()
  if (!emp) throw new Error('Employee record not found')

  const { error } = await supabase.from('shift_bid_submissions').upsert(
    { cycle_id: cycleId, employee_id: emp.id, preferences },
    { onConflict: 'cycle_id,employee_id' }
  )
  if (error) throw new Error(error.message)
  revalidatePath('/driver/bids')
}
