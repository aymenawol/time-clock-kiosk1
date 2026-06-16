'use server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/auth/rbac'
import { calcDailyHours } from '@/lib/payroll-calc'
import { writePerformanceSnapshotAction } from '@/actions/performance-snapshot'
import type { BusStatus } from '@/lib/supabase'

// Radio code → bus status mapping
const RADIO_STATUS_MAP: Record<string, BusStatus | null> = {
  '10-8':  'in_service',
  '10-39': 'in_service',   // driver on break, bus still in service
  '10-37': 'fuel',         // fueling/wash
  '10-7':  'shopped_dvir', // out of service
}

// Roles to notify per radio code
const RADIO_NOTIFY_ROLES: Record<string, string[]> = {
  '10-8':  ['dispatcher'],
  '10-39': ['dispatcher', 'supervisor'],
  '10-37': ['dispatcher', 'admin', 'supervisor'],
  '10-7':  ['dispatcher', 'management'],
}

export async function radioCodeAction(
  shiftId: string,
  busId: string | null,
  busNumber: string | null,
  code: string,
  employeeName: string
): Promise<{ error?: string }> {
  const auth = await requireUser()
  if (!auth.ok) return { error: auth.error }

  const admin = createSupabaseAdmin()

  // 1. Update bus status
  const newStatus = RADIO_STATUS_MAP[code]
  if (busId && newStatus) {
    const { error: busErr } = await admin.from('buses').update({ status: newStatus }).eq('id', busId)
    if (busErr) return { error: busErr.message }
  }

  // 2. Also update shift radio_status
  const { error: shiftErr } = await admin.from('shifts').update({ radio_status: code }).eq('id', shiftId)
  if (shiftErr) return { error: shiftErr.message }

  // 3. Fire notifications to relevant roles.
  //    notification_queue.recipient_id is a FK to employees.id — use the
  //    employee id (NOT auth_user_id, which silently violates the FK).
  const rolesToNotify = RADIO_NOTIFY_ROLES[code] ?? ['dispatcher']

  const { data: recipients } = await admin
    .from('employees')
    .select('id')
    .in('role', rolesToNotify)
    .eq('status', 'active')

  if (recipients && recipients.length > 0) {
    const notifRows = recipients.map((emp: { id: string }) => ({
      recipient_id: emp.id,
      event_type: 'radio_code',
      channel: 'in_app',
      payload: {
        code,
        bus_number: busNumber,
        employee_name: employeeName,
        shift_id: shiftId,
      },
    }))
    const { error: notifErr } = await admin.from('notification_queue').insert(notifRows)
    if (notifErr) return { error: notifErr.message }
  }

  return {}
}

// Called when a pre/post-trip inspection is submitted WITH defects: take the bus
// out of service (DVIR shop) so it can't be reassigned with an open safety defect,
// and alert technicians + dispatch.
export async function flagBusOutOfServiceAction(
  busId: string,
  shiftId: string,
  busNumber: string | null
): Promise<{ error?: string }> {
  const auth = await requireUser()
  if (!auth.ok) return { error: auth.error }

  const admin = createSupabaseAdmin()

  const { error: busErr } = await admin.from('buses').update({ status: 'shopped_dvir' }).eq('id', busId)
  if (busErr) return { error: busErr.message }

  const { data: recipients } = await admin
    .from('employees')
    .select('id')
    .in('role', ['technician', 'dispatcher', 'management'])
    .eq('status', 'active')

  if (recipients && recipients.length > 0) {
    await admin.from('notification_queue').insert(recipients.map((r: { id: string }) => ({
      recipient_id: r.id,
      event_type: 'maintenance_reminder',
      channel: 'in_app',
      payload: {
        title: 'Bus flagged for repair',
        message: `Bus ${busNumber ?? ''} reported defects on inspection.`.trim(),
        bus_id: busId,
        shift_id: shiftId,
      },
    })))
  }

  return {}
}

export async function submitEndOfShiftAction(data: {
  shiftId: string
  busId: string | null
  busType: string
  fuelLevelPct: number | null
  fuelLabel: string | null
  evBatteryPct: number | null
  statusSubmitted: 'ready' | 'charge_required' | 'shop' | 'hazard'
  notes: string
}): Promise<{ error?: string }> {
  const auth = await requireUser()
  if (!auth.ok) return { error: auth.error }

  const admin = createSupabaseAdmin()

  // Get employee id
  const { data: emp } = await admin
    .from('employees')
    .select('id')
    .eq('auth_user_id', auth.user.id)
    .single()

  if (!emp) return { error: 'Employee record not found' }

  // Map submitted status to bus status
  const busStatusMap: Record<string, BusStatus> = {
    ready:           'ready',
    charge_required: 'charging',
    shop:            'shopped_dvir',
    hazard:          'safety_hold',
  }
  const newBusStatus = busStatusMap[data.statusSubmitted] ?? 'ready'

  // Insert end of shift submission
  const { error: insertErr } = await admin.from('end_of_shift_submissions').insert({
    shift_id:        data.shiftId,
    bus_id:          data.busId,
    employee_id:     emp.id,
    bus_type:        data.busType,
    fuel_level_pct:  data.fuelLevelPct,
    fuel_label:      data.fuelLabel,
    ev_battery_pct:  data.evBatteryPct,
    status_submitted: data.statusSubmitted,
    notes:           data.notes || null,
  })
  if (insertErr) return { error: insertErr.message }

  // Update bus fuel_level and status
  if (data.busId) {
    const busUpdate: Record<string, unknown> = { status: newBusStatus }
    if (data.busType === 'EV' && data.evBatteryPct != null) {
      busUpdate.fuel_level = data.evBatteryPct
    } else if (data.fuelLevelPct != null) {
      busUpdate.fuel_level = data.fuelLevelPct
    }
    const { error: busErr } = await admin.from('buses').update(busUpdate).eq('id', data.busId)
    if (busErr) return { error: busErr.message }
  }

  // ── Close the shift (keystone): stamp end time, compute hours, free tablet ──
  const { data: shiftRow } = await admin
    .from('shifts')
    .select('actual_start, tablet_id, status')
    .eq('id', data.shiftId)
    .single()

  const nowIso = new Date().toISOString()
  let totalHours: number | null = null
  if (shiftRow?.actual_start) {
    const { totalHours: t } = calcDailyHours(new Date(shiftRow.actual_start as string), new Date(nowIso))
    totalHours = Math.round(t * 100) / 100 // NUMERIC(5,2)
  }

  const { error: closeErr } = await admin.from('shifts').update({
    actual_end:  nowIso,
    status:      'completed',
    total_hours: totalHours,
  }).eq('id', data.shiftId)
  if (closeErr) return { error: closeErr.message }

  // Release the assigned tablet back to the pool
  if (shiftRow?.tablet_id) {
    await admin.from('tablets').update({ is_available: true }).eq('id', shiftRow.tablet_id)
  }

  // Hazard → alert dispatch + management (recipient_id = employees.id, per FK)
  if (data.statusSubmitted === 'hazard') {
    const { data: recipients } = await admin
      .from('employees')
      .select('id')
      .in('role', ['dispatcher', 'management', 'admin'])
      .eq('status', 'active')

    if (recipients && recipients.length > 0) {
      const notifRows = recipients.map((r: { id: string }) => ({
        recipient_id: r.id,
        event_type: 'hazard_alert',
        channel: 'in_app',
        payload: {
          bus_id: data.busId,
          shift_id: data.shiftId,
          notes: data.notes,
          severity: 'hazard',
        },
      }))
      await admin.from('notification_queue').insert(notifRows)
    }
  }

  // Best-effort performance snapshot — never block shift close on it.
  try {
    await writePerformanceSnapshotAction(data.shiftId)
  } catch {
    /* non-fatal */
  }

  return {}
}
