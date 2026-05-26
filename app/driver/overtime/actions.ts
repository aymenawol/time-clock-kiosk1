'use server'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'

async function getEmployeeId(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string) {
  const { data } = await supabase.from('employees').select('id').eq('auth_user_id', userId).single()
  return data?.id ?? null
}

export async function submitOtBidAction(shiftId: string) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createSupabaseServerClient()
  const employeeId = await getEmployeeId(supabase, user.id)
  if (!employeeId) throw new Error('Employee not found')

  const { error } = await supabase.from('overtime_bids').insert({
    overtime_shift_id: shiftId,
    employee_id:       employeeId,
  })
  if (error && error.code !== '23505') throw new Error(error.message) // ignore unique conflict
  revalidatePath('/driver/overtime')
}

export async function respondOffDayAction(
  requestId: string,
  response: 'accepted' | 'declined' | 'custom',
  availableStartTime?: string,
  availableHours?: number,
  customAvailability?: string
) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('off_day_requests').update({
    response,
    available_start_time: availableStartTime || null,
    available_hours:      availableHours || null,
    custom_availability:  customAvailability || null,
    responded_at:         new Date().toISOString(),
  }).eq('id', requestId)

  if (error) throw new Error(error.message)
  revalidatePath('/driver/overtime')
}
