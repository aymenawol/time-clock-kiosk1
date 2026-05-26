'use server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
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
  const { user } = await import('@/lib/supabase-server').then(m => m.getServerUser())
  if (!user) return { error: 'Unauthorized' }

  const admin = createSupabaseAdmin()
  const supabaseUser = await createSupabaseServerClient()

  // 1. Update bus status
  const newStatus = RADIO_STATUS_MAP[code]
  if (busId && newStatus) {
    await admin.from('buses').update({ status: newStatus }).eq('id', busId)
  }

  // 2. Also update shift radio_status
  await admin.from('shifts').update({ radio_status: code }).eq('id', shiftId)

  // 3. Fire notifications to relevant roles
  const rolesToNotify = RADIO_NOTIFY_ROLES[code] ?? ['dispatcher']

  const { data: recipients } = await admin
    .from('employees')
    .select('auth_user_id')
    .in('role', rolesToNotify)
    .eq('status', 'active')
    .not('auth_user_id', 'is', null)

  if (recipients && recipients.length > 0) {
    const notifRows = recipients.flatMap((emp: { auth_user_id: string }) => [
      {
        recipient_id: emp.auth_user_id,
        event_type: 'radio_code',
        channel: 'in_app',
        payload: {
          code,
          bus_number: busNumber,
          employee_name: employeeName,
          shift_id: shiftId,
        },
      },
    ])
    await admin.from('notification_queue').insert(notifRows)
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
  const { user } = await import('@/lib/supabase-server').then(m => m.getServerUser())
  if (!user) return { error: 'Unauthorized' }

  const admin = createSupabaseAdmin()

  // Get employee id
  const { data: emp } = await admin
    .from('employees')
    .select('id')
    .eq('auth_user_id', user.id)
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
    await admin.from('buses').update(busUpdate).eq('id', data.busId)
  }

  // Hazard → purple alert to dispatch + management
  if (data.statusSubmitted === 'hazard') {
    const { data: recipients } = await admin
      .from('employees')
      .select('auth_user_id')
      .in('role', ['dispatcher', 'management', 'admin'])
      .eq('status', 'active')
      .not('auth_user_id', 'is', null)

    if (recipients && recipients.length > 0) {
      const notifRows = recipients.map((r: { auth_user_id: string }) => ({
        recipient_id: r.auth_user_id,
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

  return {}
}
