'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getServerUser } from '@/lib/supabase-server'
import { calcDailyHours, calcWeeklyOT, shouldRaiseFatigueAlert } from '@/lib/payroll-calc'

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

  for (const shift of (shifts ?? [])) {
    if (!shift.actual_start) continue

    const workDate = shift.actual_start.split('T')[0]
    const clockIn  = new Date(shift.actual_start)
    const hasClockOut = !!shift.actual_end

    const { regular_hours: reg, overtime_hours: ot, totalHours } = hasClockOut
      ? calcDailyHours(clockIn, new Date(shift.actual_end!))
      : { regular_hours: 0, overtime_hours: 0, totalHours: 0 }

    // Count missed breaks
    const missedBreaks = ((shift.breaks as unknown[]) ?? []).filter((b: Record<string, unknown>) => b.status === 'missed').length

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

    // Raise fatigue alert if single shift > 10h
    if (hasClockOut && shouldRaiseFatigueAlert(totalHours)) {
      await admin.from('fatigue_alerts').upsert({
        employee_id: shift.employee_id,
        alert_type: 'single_shift',
        shift_id: shift.id,
        shift_hours: totalHours,
      }, { onConflict: 'employee_id,shift_id,alert_type', ignoreDuplicates: true })
    }
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
    changes: updates,
  }

  const { error } = await admin
    .from('daily_hours_records')
    .update({
      ...updates,
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

  const admin = createSupabaseAdmin()
  await admin.from('payroll_exports').insert({
    pay_period_id: payPeriodId,
    exported_by: user.id,
    row_count: rowCount,
  })
}
