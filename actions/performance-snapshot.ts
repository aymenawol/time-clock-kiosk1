'use server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'

/**
 * Writes/updates the performance snapshot for a shift. Called (best-effort) when
 * a shift is closed at end-of-shift.
 *
 * Reconciled to the real schema: shifts use actual_start/actual_end (not
 * clock_in/clock_out). Attendance lateness and the safety-meeting / inspection /
 * counting-sheet metrics are computed by the dedicated performance job (N25);
 * here we record the two metrics that are reliable at close time (attendance
 * present + missed-break count). Omitted snapshot columns default to 0.
 */
export async function writePerformanceSnapshotAction(shiftId: string) {
  const admin = createSupabaseAdmin()

  const { data: shift, error: shiftErr } = await admin
    .from('shifts')
    .select('id, employee_id, date, actual_start, actual_end, status')
    .eq('id', shiftId)
    .single()

  if (shiftErr || !shift) return { error: 'Shift not found' }

  const snapshotDate =
    (shift.actual_start
      ? new Date(shift.actual_start as string).toISOString().split('T')[0]
      : (shift.date as string)) ?? new Date().toISOString().split('T')[0]

  // Missed breaks recorded for this shift
  const { count: missedBreaks } = await admin
    .from('breaks')
    .select('id', { count: 'exact', head: true })
    .eq('shift_id', shiftId)
    .eq('status', 'missed')

  const { error } = await admin.from('driver_performance_snapshots').upsert(
    {
      employee_id:         shift.employee_id,
      snapshot_date:       snapshotDate,
      shift_id:            shiftId,
      attendance_status:   'present',
      missed_breaks_count: missedBreaks ?? 0,
    },
    { onConflict: 'employee_id,snapshot_date,shift_id' }
  )

  if (error) return { error: error.message }
  return { success: true }
}
