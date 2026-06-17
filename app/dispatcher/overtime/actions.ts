'use server'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import { enqueueNotificationBatch } from '@/lib/notifications'
import { PostOtShiftSchema, OffDayRequestSchema } from '@/lib/schemas/overtime'

export async function postOtShiftAction(formData: FormData) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')
  if (!['admin', 'management', 'dispatcher'].includes((user.app_metadata?.role as string) ?? '')) throw new Error('Forbidden')

  const parsed = PostOtShiftSchema.safeParse({
    date:            formData.get('date'),
    start_time:      formData.get('start_time'),
    duration_hours:  Number(formData.get('duration_hours')),
    slots_available: Number(formData.get('slots_available') ?? 1),
    description:     (formData.get('description') as string) || null,
    bid_close_at:    (formData.get('bid_close_at') as string) || null,
  })
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid overtime shift')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('overtime_shifts').insert({
    ...parsed.data,
    posted_by:       user.id,
    status:          'open',
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dispatcher/overtime')
}

export async function closeOtShiftAction(shiftId: string) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')
  if (!['admin', 'management', 'dispatcher'].includes((user.app_metadata?.role as string) ?? '')) throw new Error('Forbidden')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('overtime_shifts').update({ status: 'closed' }).eq('id', shiftId)
  if (error) throw new Error(error.message)
  revalidatePath('/dispatcher/overtime')
}

export async function updateBannerAction(isActive: boolean, message: string) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')
  if (!['admin', 'management', 'dispatcher'].includes((user.app_metadata?.role as string) ?? '')) throw new Error('Forbidden')

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
  if (!['admin', 'management', 'dispatcher'].includes((user.app_metadata?.role as string) ?? '')) throw new Error('Forbidden')

  const parsed = OffDayRequestSchema.safeParse({
    employee_id:    formData.get('employee_id'),
    requested_date: formData.get('requested_date'),
    message:        (formData.get('message') as string) || null,
  })
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid off-day request')
  const { employee_id: employeeId, requested_date: requestedDate } = parsed.data

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('off_day_requests').insert({
    employee_id:    employeeId,
    requested_date: requestedDate,
    message:        parsed.data.message ?? null,
    posted_by:      user.id,
    response:       'pending',
  })
  if (error) throw new Error(error.message)

  // N8 — notify the driver of the off-day / availability request.
  if (employeeId) {
    await enqueueNotificationBatch([{
      recipientId: employeeId,
      eventType: 'off_day_request',
      channels: ['in_app'],
      payload: {
        title: 'Off-day availability request',
        message: `You have a new availability request${requestedDate ? ` for ${requestedDate}` : ''}. Please respond.`,
      },
    }])
  }

  revalidatePath('/dispatcher/overtime')
}
