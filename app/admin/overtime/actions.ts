'use server'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import { enqueueNotificationBatch } from '@/lib/notifications'

export async function postOtShiftAction(formData: FormData) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')
  if (!['admin', 'management', 'dispatcher'].includes((user.app_metadata?.role as string) ?? '')) throw new Error('Forbidden')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('overtime_shifts').insert({
    date:           formData.get('date') as string,
    start_time:     formData.get('start_time') as string,
    duration_hours: Number(formData.get('duration_hours')),
    slots_available: Number(formData.get('slots_available') || 1),
    description:    (formData.get('description') as string) || null,
    bid_close_at:   (formData.get('bid_close_at') as string) || null,
    posted_by:      user.id,
    status:         'open',
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/overtime')
  revalidatePath('/dispatcher/overtime')
}

export async function closeOtShiftAction(shiftId: string) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')
  if (!['admin', 'management', 'dispatcher'].includes((user.app_metadata?.role as string) ?? '')) throw new Error('Forbidden')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('overtime_shifts').update({ status: 'closed' }).eq('id', shiftId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/overtime')
}

export async function cancelOtShiftAction(shiftId: string) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')
  if (!['admin', 'management', 'dispatcher'].includes((user.app_metadata?.role as string) ?? '')) throw new Error('Forbidden')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('overtime_shifts').update({ status: 'cancelled' }).eq('id', shiftId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/overtime')
}

export async function awardOtShiftAction(shiftId: string) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')
  if (!['admin', 'management', 'dispatcher'].includes((user.app_metadata?.role as string) ?? '')) throw new Error('Forbidden')

  const supabase = await createSupabaseServerClient()

  // Get shift info
  const { data: shift } = await supabase.from('overtime_shifts').select('slots_available').eq('id', shiftId).single()
  if (!shift) throw new Error('Shift not found')

  // Get bids with seniority info, ordered by seniority
  const { data: bids } = await supabase
    .from('overtime_bids')
    .select('*, employees(seniority_number, hire_date)')
    .eq('overtime_shift_id', shiftId)

  if (!bids?.length) throw new Error('No bids to award')

  const sorted = [...bids].sort((a, b) => {
    const sA = (a as any).employees?.seniority_number ?? 9999
    const sB = (b as any).employees?.seniority_number ?? 9999
    if (sA !== sB) return sA - sB
    const hA = (a as any).employees?.hire_date ?? '9999-99-99'
    const hB = (b as any).employees?.hire_date ?? '9999-99-99'
    return hA < hB ? -1 : hA > hB ? 1 : 0
  })

  const toAward = sorted.slice(0, shift.slots_available)
  const awards = toAward.map((bid: any) => ({
    overtime_shift_id: shiftId,
    employee_id: bid.employee_id,
    award_method: 'seniority',
    awarded_by: user.id,
  }))

  const { error } = await supabase.from('overtime_awards').insert(awards)
  if (error) throw new Error(error.message)

  await supabase.from('overtime_shifts').update({ status: 'awarded' }).eq('id', shiftId)

  // N8 — notify each awarded employee (in-app via queue→trigger; email via processor).
  const { data: shiftInfo } = await supabase
    .from('overtime_shifts')
    .select('date, start_time, duration_hours')
    .eq('id', shiftId)
    .single()
  await enqueueNotificationBatch(
    toAward.map((bid: any) => ({
      recipientId: bid.employee_id,
      eventType: 'overtime_awarded',
      channels: ['in_app'],
      payload: {
        title: 'Overtime awarded',
        message: `You were awarded an overtime shift${
          shiftInfo?.date ? ` on ${shiftInfo.date}` : ''
        }${shiftInfo?.start_time ? ` at ${shiftInfo.start_time}` : ''}.`,
        overtime_shift_id: shiftId,
      },
    }))
  )

  revalidatePath('/admin/overtime')
}

export async function updateBannerAction(formData: FormData) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')
  if (!['admin', 'management', 'dispatcher'].includes((user.app_metadata?.role as string) ?? '')) throw new Error('Forbidden')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('ot_banner')
    .update({
      is_active:  formData.get('is_active') === 'true',
      message:    formData.get('message') as string,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'singleton')

  if (error) throw new Error(error.message)
  revalidatePath('/admin/overtime')
  revalidatePath('/dispatcher/overtime')
  revalidatePath('/driver')
}

export async function sendOffDayRequestAction(formData: FormData) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')
  if (!['admin', 'management', 'dispatcher'].includes((user.app_metadata?.role as string) ?? '')) throw new Error('Forbidden')

  const supabase = await createSupabaseServerClient()
  const employeeId = formData.get('employee_id') as string
  const requestedDate = formData.get('requested_date') as string
  const { error } = await supabase.from('off_day_requests').insert({
    employee_id:    employeeId,
    requested_date: requestedDate,
    message:        (formData.get('message') as string) || null,
    posted_by:      user.id,
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

  revalidatePath('/admin/overtime')
  revalidatePath('/dispatcher/overtime')
}
