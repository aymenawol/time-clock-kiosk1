'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getServerUser } from '@/lib/supabase-server'
import {
  calcDailyHours, calcWeeklyOT, shouldRaiseFatigueAlert,
  maxDaysInAnyWeek, weeklyOtHours, WEEKLY_DAYS_LIMIT, WEEKLY_OT_ALERT_HOURS,
} from '@/lib/payroll-calc'
import { enqueueNotificationBatch } from '@/lib/notifications'
import { failValidation } from '@/lib/actions/result'
import { DailyHoursCorrectionSchema } from '@/lib/schemas/payroll'

// ─────────────────────────────────────────────────────────────
// Create pay period
// ─────────────────────────────────────────────────────────────

export async function createPayPeriodAction(periodStart: string, periodEnd: string, payDate: string) {
  const { user } = await getServerUser()
  if (!user) return { error: 'Unauthorized' }

  const role = user.app_metadata?.role as string
  if (!['admin', 'payroll'].includes(role)) return { error: 'Insufficient permissions' }

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('pay_periods')
    .insert({ period_start: periodStart, period_end: periodEnd, pay_date: payDate, created_by: user.id })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/admin/payroll')
  return { id: data.id }
}

// ─────────────────────────────────────────────────────────────
// Calculate & upsert daily_hours_records for a pay period
// Reads raw clock-in/clock-out from `shifts` table
// ─────────────────────────────────────────────────────────────

export async function calculatePayPeriodHoursAction(payPeriodId: string) {
  const { user } = await getServerUser()
  if (!user) return { error: 'Unauthorized' }

  const role = user.app_metadata?.role as string
  if (!['admin', 'payroll'].includes(role)) return { error: 'Insufficient permissions' }

  const admin = createSupabaseAdmin()

  // Load pay period dates
  const { data: period, error: pErr } = await admin
    .from('pay_periods')
    .select('period_start, period_end')
    .eq('id', payPeriodId)
    .single()

  if (pErr || !period) return { error: 'Pay period not found' }

  // Load all completed/active shifts within the period
  const { data: shifts, error: sErr } = await admin
    .from('shifts')
    .select('id, employee_id, actual_start, actual_end, status, breaks(actual_start, actual_end, duration_minutes, status)')
    .gte('actual_start', period.period_start)
    .lte('actual_start', period.period_end + 'T23:59:59')
    .in('status', ['completed', 'active'])

  if (sErr) return { error: sErr.message }

  const records: {
    employee_id: string; pay_period_id: string; work_date: string; shift_id: string
    clock_in: string; clock_out: string | null; regular_hours: number; overtime_hours: number
    missed_breaks: number; is_incomplete: boolean
  }[] = []

  // Accumulate single-shift fatigue alerts and write them in ONE batched upsert
  // after the loop (was a per-row upsert inside the loop — O(n) round-trips).
  const singleShiftFatigue: {
    employee_id: string; alert_type: 'single_shift'; shift_id: string; shift_hours: number
  }[] = []

  for (const shift of (shifts ?? [])) {
    if (!shift.actual_start) continue

    const workDate = shift.actual_start.split('T')[0]
    const clockIn  = new Date(shift.actual_start)
    const hasClockOut = !!shift.actual_end

    const { regularHours: reg, overtimeHours: ot, totalHours } = hasClockOut
      ? calcDailyHours(clockIn, new Date(shift.actual_end!))
      : { regularHours: 0, overtimeHours: 0, totalHours: 0 }

    // Count missed breaks
    const missedBreaks = ((shift.breaks as unknown[]) ?? []).filter((b) => (b as Record<string, unknown>).status === 'missed').length

    records.push({
      employee_id:   shift.employee_id,
      pay_period_id: payPeriodId,
      work_date:     workDate,
      shift_id:      shift.id,
      clock_in:      shift.actual_start,
      clock_out:     shift.actual_end ?? null,
      regular_hours: reg,
      overtime_hours: ot,
      missed_breaks:  missedBreaks,
      is_incomplete:  !hasClockOut,
    })

    // Raise fatigue alert if single shift > 10h (collected, batched after loop)
    if (hasClockOut && shouldRaiseFatigueAlert(totalHours)) {
      singleShiftFatigue.push({
        employee_id: shift.employee_id,
        alert_type: 'single_shift',
        shift_id: shift.id,
        shift_hours: totalHours,
      })
    }
  }

  if (singleShiftFatigue.length) {
    await admin.from('fatigue_alerts').upsert(singleShiftFatigue, {
      onConflict: 'employee_id,shift_id,alert_type',
      ignoreDuplicates: true,
    })
  }

  // Apply weekly 40-hour OT check per employee
  const empMap: Record<string, typeof records> = {}
  for (const r of records) {
    empMap[r.employee_id] = [...(empMap[r.employee_id] ?? []), r]
  }

  const finalRecords = Object.values(empMap).flatMap(empRecords => {
    const adjusted = calcWeeklyOT(empRecords.map(r => ({
      work_date:      r.work_date,
      regular_hours:  r.regular_hours,
      overtime_hours: r.overtime_hours,
      pto_hours:      0,
      fmla_hours:     0,
    })))
    return empRecords.map((r, i) => ({ ...r, ...adjusted[i] }))
  })

  // Upsert all records
  const { error: uErr } = await admin
    .from('daily_hours_records')
    .upsert(finalRecords, { onConflict: 'employee_id,work_date' })

  if (uErr) return { error: uErr.message }

  // N8 — weekly fatigue thresholds (spec: flag >5 days/week or high weekly OT).
  // The fatigue_alert_notify trigger fans these out to the driver + dispatch.
  // Collect candidates, then dedupe against open alerts and bulk-insert — was a
  // per-employee select+insert loop (O(n) sequential round-trips).
  const weeklyCandidates: {
    employee_id: string
    alert_type: 'consecutive_days' | 'ot_threshold'
    consecutive_count?: number
    weekly_ot_hours?: number
  }[] = []
  for (const [employeeId, recs] of Object.entries(empMap)) {
    const workDates = recs.map(r => r.work_date)
    const maxDays = maxDaysInAnyWeek(workDates)
    if (maxDays > WEEKLY_DAYS_LIMIT) {
      weeklyCandidates.push({ employee_id: employeeId, alert_type: 'consecutive_days', consecutive_count: maxDays })
    }
    const otByWeek = weeklyOtHours(finalRecords.filter(r => r.employee_id === employeeId))
    const peakWeeklyOt = Math.max(0, ...Object.values(otByWeek))
    if (peakWeeklyOt >= WEEKLY_OT_ALERT_HOURS) {
      weeklyCandidates.push({ employee_id: employeeId, alert_type: 'ot_threshold', weekly_ot_hours: peakWeeklyOt })
    }
  }

  if (weeklyCandidates.length) {
    // One query to find which (employee, type) already have an OPEN weekly alert,
    // then one insert for the rest — preserves the "skip if already open" rule.
    const { data: openAlerts } = await admin
      .from('fatigue_alerts')
      .select('employee_id, alert_type')
      .in('employee_id', weeklyCandidates.map(c => c.employee_id))
      .in('alert_type', ['consecutive_days', 'ot_threshold'])
      .is('shift_id', null)
      .is('resolved_at', null)
      .is('dismissed_at', null)
    const open = new Set((openAlerts ?? []).map(a => `${a.employee_id}:${a.alert_type}`))
    const toInsert = weeklyCandidates.filter(c => !open.has(`${c.employee_id}:${c.alert_type}`))
    if (toInsert.length) {
      await admin.from('fatigue_alerts').insert(toInsert)
    }
  }

  revalidatePath(`/admin/payroll/${payPeriodId}`)
  return { count: finalRecords.length }
}

// ─────────────────────────────────────────────────────────────
// Close pay period (blocks if incomplete records exist)
// ─────────────────────────────────────────────────────────────

export async function closePayPeriodAction(payPeriodId: string) {
  const { user } = await getServerUser()
  if (!user) return { error: 'Unauthorized' }

  const role = user.app_metadata?.role as string
  if (!['admin', 'payroll'].includes(role)) return { error: 'Insufficient permissions' }

  const admin = createSupabaseAdmin()

  // Check for incomplete records
  const { count } = await admin
    .from('daily_hours_records')
    .select('id', { count: 'exact', head: true })
    .eq('pay_period_id', payPeriodId)
    .eq('is_incomplete', true)

  if ((count ?? 0) > 0) {
    return { error: `Cannot close — ${count} employee record(s) have missing clock-out data.` }
  }

  const { error } = await admin
    .from('pay_periods')
    .update({ status: 'closed', closed_by: user.id, closed_at: new Date().toISOString() })
    .eq('id', payPeriodId)

  if (error) return { error: error.message }

  // N8 — auto-send the closed period to payroll staff (in-app + email via processor).
  // These three reads are independent — run them in parallel instead of serially.
  const [{ data: period }, { data: totals }, { data: payrollStaff }] = await Promise.all([
    admin
      .from('pay_periods')
      .select('period_start, period_end')
      .eq('id', payPeriodId)
      .maybeSingle(),
    admin
      .from('daily_hours_records')
      .select('regular_hours, overtime_hours')
      .eq('pay_period_id', payPeriodId),
    admin
      .from('employees')
      .select('id')
      .eq('status', 'active')
      .not('auth_user_id', 'is', null)
      .in('role', ['payroll', 'admin', 'management']),
  ])
  const regSum = (totals ?? []).reduce((s, r) => s + (r.regular_hours || 0), 0)
  const otSum = (totals ?? []).reduce((s, r) => s + (r.overtime_hours || 0), 0)
  if (payrollStaff?.length) {
    await enqueueNotificationBatch(
      payrollStaff.map((e: { id: string }) => ({
        recipientId: e.id,
        eventType: 'payroll_period_closed',
        channels: ['in_app' as const],
        payload: {
          title: 'Pay period closed',
          message: `Pay period ${period?.period_start ?? ''}–${period?.period_end ?? ''} closed: ${regSum.toFixed(1)} reg + ${otSum.toFixed(1)} OT hours.`,
          pay_period_id: payPeriodId,
        },
      }))
    )
  }

  revalidatePath('/admin/payroll')
  revalidatePath(`/admin/payroll/${payPeriodId}`)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// Correct a daily hours record (admin override with audit log)
// ─────────────────────────────────────────────────────────────

export async function correctDailyHoursAction(
  recordId: string,
  updates: { regular_hours?: number; overtime_hours?: number; pto_hours?: number; fmla_hours?: number },
  reason: string
) {
  const { user } = await getServerUser()
  if (!user) return { error: 'Unauthorized' }

  const role = user.app_metadata?.role as string
  if (!['admin', 'payroll'].includes(role)) return { error: 'Insufficient permissions' }

  const parsed = DailyHoursCorrectionSchema.safeParse(updates)
  if (!parsed.success) return failValidation(parsed.error)
  const corrections = parsed.data

  const admin = createSupabaseAdmin()

  // Read existing record to build audit entry
  const { data: existing } = await admin
    .from('daily_hours_records')
    .select('regular_hours, overtime_hours, pto_hours, fmla_hours, audit_log')
    .eq('id', recordId)
    .single()

  if (!existing) return { error: 'Record not found' }

  const auditEntry = {
    corrected_at: new Date().toISOString(),
    corrected_by: user.id,
    reason,
    previous: {
      regular_hours:  existing.regular_hours,
      overtime_hours: existing.overtime_hours,
      pto_hours:      existing.pto_hours,
      fmla_hours:     existing.fmla_hours,
    },
    changes: corrections,
  }

  const { error } = await admin
    .from('daily_hours_records')
    .update({
      ...corrections,
      audit_log: [...((existing.audit_log as unknown[]) ?? []), auditEntry],
    })
    .eq('id', recordId)

  if (error) return { error: error.message }
  revalidatePath('/admin/payroll')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// Log payroll export event
// ─────────────────────────────────────────────────────────────

export async function logPayrollExportAction(payPeriodId: string, rowCount: number) {
  const { user } = await getServerUser()
  if (!user) return

  // Writes to payroll_exports via the RLS-bypassing admin client, so enforce
  // the same role gate as the other payroll actions (admin/payroll only).
  const role = user.app_metadata?.role as string
  if (!['admin', 'payroll'].includes(role)) return

  const admin = createSupabaseAdmin()
  await admin.from('payroll_exports').insert({
    pay_period_id: payPeriodId,
    exported_by: user.id,
    row_count: rowCount,
  })
}
