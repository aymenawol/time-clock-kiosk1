'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { BusStatus } from '@/lib/supabase'
import { BUS_STATUS_LABELS } from '@/lib/supabase'
import { failValidation } from '@/lib/actions/result'
import { CreateBusSchema, UpdateBusSchema } from '@/lib/schemas/bus'

async function requireAdminRole() {
  const { user } = await import('@/lib/supabase-server').then(m => m.getServerUser())
  if (!user) throw new Error('Unauthorized')
  const role = (user.app_metadata?.role as string) ?? ''
  if (!['admin', 'management'].includes(role)) throw new Error('Forbidden')
  return user
}

export async function createBusAction(data: {
  bus_number: string
  vin?: string
  bus_type: 'EV' | 'Diesel'
  fuel_level?: number
  current_mileage?: number
  notes?: string
}) {
  await requireAdminRole()
  const parsed = CreateBusSchema.safeParse(data)
  if (!parsed.success) return failValidation(parsed.error)
  const supabase = createSupabaseAdmin()
  const { error } = await supabase.from('buses').insert({
    bus_number:      data.bus_number.trim().toUpperCase(),
    vin:             data.vin?.trim() || null,
    bus_type:        data.bus_type,
    fuel_level:      data.fuel_level ?? null,
    current_mileage: data.current_mileage ?? null,
    notes:           data.notes?.trim() || null,
    status:          'ready',
    is_active:       true,
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/buses')
  return { success: true }
}

export async function updateBusAction(
  id: string,
  data: Partial<{
    bus_number: string
    vin: string | null
    bus_type: 'EV' | 'Diesel'
    fuel_level: number | null
    current_mileage: number | null
    notes: string | null
    is_active: boolean
  }>
) {
  await requireAdminRole()
  const parsed = UpdateBusSchema.safeParse(data)
  if (!parsed.success) return failValidation(parsed.error)
  const supabase = createSupabaseAdmin()
  const { error } = await supabase.from('buses').update(parsed.data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/buses')
  revalidatePath(`/admin/buses/${id}`)
  return { success: true }
}

export async function updateBusStatusAction(
  id: string,
  status: BusStatus,
  reason?: string
) {
  // RLS is bypassed below (service-role admin client), so authz MUST be
  // enforced here — mirrors createBusAction/updateBusAction/deleteBusAction.
  const user = await requireAdminRole()

  // Validate against the known status set (drift-proof: keys of the label map).
  if (!Object.prototype.hasOwnProperty.call(BUS_STATUS_LABELS, status)) {
    return { error: 'Invalid bus status' }
  }

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('buses')
    .update({ status })
    .eq('id', id)

  if (error) return { error: error.message }

  // Also record the reason in the manually-inserted history entry if provided
  if (reason?.trim()) {
    await admin.from('bus_status_history').insert({
      bus_id:     id,
      to_status:  status,
      changed_by: user.id,
      reason:     reason.trim(),
    })
  }

  revalidatePath('/admin/buses')
  revalidatePath(`/admin/buses/${id}`)
  revalidatePath('/dispatcher')
  return { success: true }
}

/**
 * Retire a bus (soft delete). A hard DELETE cascades away bus_status_history
 * and repair_notes — losing the maintenance audit trail — and nulls shift.bus_id.
 * We deactivate instead: the bus drops out of the active fleet view (the UI
 * already lists inactive buses separately) while its history is preserved.
 */
export async function deleteBusAction(id: string) {
  await requireAdminRole()
  const supabase = createSupabaseAdmin()
  const { error } = await supabase.from('buses').update({ is_active: false }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/buses')
  revalidatePath(`/admin/buses/${id}`)
  return { success: true }
}

export async function createTabletAction(data: {
  tablet_number: string
  serial_number?: string
  notes?: string
}) {
  await requireAdminRole()
  const supabase = createSupabaseAdmin()
  const { error } = await supabase.from('tablets').insert({
    tablet_number: data.tablet_number.trim().toUpperCase(),
    serial_number: data.serial_number?.trim() || null,
    notes:         data.notes?.trim() || null,
    is_available:  true,
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/buses')
  return { success: true }
}

export async function getBusesAction() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('buses')
    .select('*')
    .order('bus_number', { ascending: true })
  if (error) return { error: error.message, buses: [] }
  return { buses: data ?? [] }
}

export async function getBusDetailAction(id: string) {
  const supabase = await createSupabaseServerClient()
  const [busRes, historyRes, shiftsRes, repairsRes, inspectionsRes] = await Promise.all([
    supabase.from('buses').select('*').eq('id', id).single(),
    supabase
      .from('bus_status_history')
      .select('*, changer:changed_by(id)')
      .eq('bus_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('shifts')
      .select('*, employee:employee_id(name)')
      .eq('bus_id', id)
      .order('date', { ascending: false })
      .limit(20),
    supabase
      .from('repair_notes')
      .select('*')
      .eq('bus_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('vehicle_inspections')
      .select('id, inspection_type, inspection_date, is_locked, submitted_at, has_defects, damage_drawing, driver:driver_id(name)')
      .eq('bus_id', id)
      .order('inspection_date', { ascending: false })
      .limit(30),
  ])
  return {
    bus:         busRes.data,
    history:     historyRes.data ?? [],
    shifts:      shiftsRes.data ?? [],
    repairs:     repairsRes.data ?? [],
    inspections: inspectionsRes.data ?? [],
    error:       busRes.error?.message,
  }
}
