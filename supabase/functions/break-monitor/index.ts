// Supabase Edge Function: break-monitor
// Runs every minute via pg_cron.
// Enforces break compliance:
//   • pending break past window_close      → status 'missed'  (+ alert dispatch)
//   • active break ≥ reminder threshold    → reminder to the driver (once)
//   • active break ≥ overstay threshold     → status 'overrun' (+ alert dispatch/mgmt)
// Thresholds come from app_settings.break_rules (defaults: 17 / 20 minutes).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const MISSED_NOTIFY_ROLES  = ['dispatcher', 'coordinator', 'supervisor']
const OVERRUN_NOTIFY_ROLES = ['dispatcher', 'management', 'supervisor']

type QueueRow = {
  recipient_id: string
  event_type: string
  channel: string
  payload: Record<string, unknown>
}

async function staffRecipientIds(roles: string[]): Promise<string[]> {
  const { data } = await supabase
    .from('employees')
    .select('id')
    .in('role', roles)
    .eq('status', 'active')
  return (data ?? []).map((e: { id: string }) => e.id)
}

async function enqueue(rows: QueueRow[]): Promise<void> {
  if (!rows.length) return
  const { error } = await supabase.from('notification_queue').insert(rows)
  if (error) console.error('break-monitor enqueue error:', error.message)
}

serve(async () => {
  try {
    const now = Date.now()
    const nowIso = new Date(now).toISOString()

    // Configurable overstay thresholds (minutes since break actual_start).
    const { data: settings } = await supabase
      .from('app_settings')
      .select('break_rules')
      .eq('id', 'singleton')
      .single()
    const rules = (settings?.break_rules ?? {}) as Record<string, unknown>
    const reminderMin = Number(rules.overstay_reminder_minutes ?? 17)
    const alertMin    = Number(rules.overstay_alert_minutes ?? 20)

    let missed = 0
    let reminders = 0
    let overruns = 0

    // ── 1. Missed breaks: pending and past their window_close ──
    const { data: pending } = await supabase
      .from('breaks')
      .select('id, shift_id, employee_id, break_number, window_close, employees!employee_id(name)')
      .eq('status', 'pending')
      .not('window_close', 'is', null)
      .lt('window_close', nowIso)

    if (pending?.length) {
      const ids = pending.map((b: { id: string }) => b.id)
      await supabase.from('breaks').update({ status: 'missed' }).in('id', ids)
      missed = pending.length

      const staff = await staffRecipientIds(MISSED_NOTIFY_ROLES)
      const rows: QueueRow[] = []
      for (const b of pending as any[]) {
        const driver = b.employees?.name ?? 'Driver'
        for (const rid of staff) {
          rows.push({
            recipient_id: rid,
            event_type: 'break_missed',
            channel: 'in_app',
            payload: {
              message: `${driver} missed break #${b.break_number}.`,
              employee_id: b.employee_id,
              shift_id: b.shift_id,
              break_number: b.break_number,
            },
          })
        }
      }
      await enqueue(rows)
    }

    // ── 2. Active breaks: reminders (17m) and overruns (20m) ──
    const { data: active } = await supabase
      .from('breaks')
      .select('id, shift_id, employee_id, break_number, actual_start, sms_reminder_sent, overrun_alert_sent, employees!employee_id(name)')
      .eq('status', 'active')
      .not('actual_start', 'is', null)

    if (active?.length) {
      const overrunStaff = await staffRecipientIds(OVERRUN_NOTIFY_ROLES)
      for (const b of active as any[]) {
        const elapsedMin = (now - Date.parse(b.actual_start)) / 60000
        const driver = b.employees?.name ?? 'Driver'

        // 17-minute reminder → the driver
        if (elapsedMin >= reminderMin && !b.sms_reminder_sent) {
          await enqueue([{
            recipient_id: b.employee_id,
            event_type: 'break_overdue',
            channel: 'in_app',
            payload: {
              message: 'Your break time is up — please return to service.',
              shift_id: b.shift_id,
              break_number: b.break_number,
            },
          }])
          await supabase.from('breaks').update({ sms_reminder_sent: true }).eq('id', b.id)
          reminders++
        }

        // 20-minute overstay → mark overrun + alert dispatch/management/supervisors
        if (elapsedMin >= alertMin && !b.overrun_alert_sent) {
          await supabase.from('breaks').update({ status: 'overrun', overrun_alert_sent: true }).eq('id', b.id)
          await enqueue(overrunStaff.map((rid) => ({
            recipient_id: rid,
            event_type: 'break_overdue',
            channel: 'in_app',
            payload: {
              message: `${driver} is overdue from break #${b.break_number} (${Math.round(elapsedMin)} min).`,
              employee_id: b.employee_id,
              shift_id: b.shift_id,
              break_number: b.break_number,
              severity: 'warning',
            },
          })))
          overruns++
        }
      }
    }

    return new Response(JSON.stringify({ missed, reminders, overruns }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('break-monitor error:', err)
    return new Response('ERROR', { status: 500 })
  }
})
