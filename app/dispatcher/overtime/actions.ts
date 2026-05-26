'use server'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'

export async function postOtShiftAction(formData: FormData) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('overtime_shifts').insert({
    date:            formData.get('date') as string,
    start_time:      formData.get('start_time') as string,
    duration_hours:  Number(formData.get('duration_hours')),
    slots_available: Number(formData.get('slots_available') ?? 1),
    description:     (formData.get('description') as string) || null,
    bid_close_at:    (formData.get('bid_close_at') as string) || null,
    posted_by:       user.id,
    status:          'open',
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dispatcher/overtime')
}

export async function closeOtShiftAction(shiftId: string) {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('overtime_shifts').update({ status: 'closed' }).eq('id', shiftId)
  if (error) throw new Error(error.message)
  revalidatePath('/dispatcher/overtime')
}

export async function updateBannerAction(isActive: boolean, message: string) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('ot_banner').update({
    is_active:  isActive,
    message,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }).eq('id', 'singleton')
  if (error) throw new Error(error.message)
  revalidatePath('/dispatcher/overtime')
  revalidatePath('/driver')
}

export async function sendOffDayRequestAction(formData: FormData) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('off_day_requests').insert({
    employee_id:    formData.get('employee_id') as string,
    requested_date: formData.get('requested_date') as string,
    message:        (formData.get('message') as string) || null,
    posted_by:      user.id,
    response:       'pending',
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dispatcher/overtime')
}
