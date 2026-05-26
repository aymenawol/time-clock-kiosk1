'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getServerUser } from '@/lib/supabase-server'

async function assertAdmin() {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')
  if (user.app_metadata?.role !== 'admin') throw new Error('Admin only')
  return user
}

export async function triggerEmergencyAction(
  eventType: 'weather' | 'airport_emergency' | 'reroute' | 'custom',
  message: string
) {
  const user   = await assertAdmin()
  const admin  = createSupabaseAdmin()

  const { data: emp } = await admin.from('employees').select('id').eq('auth_user_id', user.id).single()
  if (!emp) return { error: 'Employee profile not found' }

  // Partial unique index enforces one active event — this will fail if one is already active
  const { data, error } = await admin.from('emergency_events').insert({
    triggered_by: emp.id,
    event_type:   eventType,
    message:      message.trim(),
    is_active:    true,
  }).select('id').single()

  if (error) {
    if (error.code === '23505') return { error: 'An emergency is already active. Resolve it first.' }
    return { error: error.message }
  }

  revalidatePath('/admin/emergency')
  return { success: true, eventId: data.id }
}

export async function resolveEmergencyAction(eventId: string) {
  const user  = await assertAdmin()
  const admin = createSupabaseAdmin()

  const { data: emp } = await admin.from('employees').select('id').eq('auth_user_id', user.id).single()
  if (!emp) return { error: 'Employee profile not found' }

  const { error } = await admin.from('emergency_events').update({
    resolved_by:  emp.id,
    resolved_at:  new Date().toISOString(),
    is_active:    false,
  }).eq('id', eventId)

  if (error) return { error: error.message }
  revalidatePath('/admin/emergency')
  return { success: true }
}

export async function getEmergencyAckStatusAction(eventId: string) {
  const admin = createSupabaseAdmin()

  const [{ data: acks }, { data: drivers }] = await Promise.all([
    admin.from('emergency_acknowledgements')
      .select('employee_id, acknowledged_at, employees(full_name)')
      .eq('event_id', eventId),
    admin.from('employees')
      .select('id, full_name')
      .in('role', ['driver', 'dispatcher', 'supervisor', 'coordinator', 'fueler_washer']),
  ])

  const ackedIds = new Set((acks ?? []).map((a: { employee_id: string }) => a.employee_id))

  type Emp = { id: string; full_name: string }
  const unacknowledged = (drivers ?? []).filter((d: Emp) => !ackedIds.has(d.id))
  const acknowledged   = (acks ?? []).map((a: {
    employee_id: string
    acknowledged_at: string
    employees: { full_name: string } | null
  }) => ({
    employeeId:     a.employee_id,
    name:           a.employees?.full_name ?? 'Unknown',
    acknowledgedAt: a.acknowledged_at,
  }))

  return { acknowledged, unacknowledged: unacknowledged as Emp[] }
}
