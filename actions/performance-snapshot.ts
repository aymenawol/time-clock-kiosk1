'use server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'

/**
 * Called when a driver's shift is signed out (from dispatcher sign-out flow).
 * Writes a performance snapshot for the given shift.
 */
export async function writePerformanceSnapshotAction(shiftId: string) {
  const admin = createSupabaseAdmin()

  // Fetch shift + related data
  const { data: shift, error: shiftErr } = await admin
    .from('shifts')
    .select(`
      id, employee_id, clock_in, clock_out, status, radio_status,
      employees!employee_id(full_name)
    `)
    .eq('id', shiftId)
    .single()

  if (shiftErr || !shift) return { error: 'Shift not found' }

  const shiftDate = new Date(shift.clock_in as string).toISOString().split('T')[0]

  // Count missed breaks (breaks with status = 'assigned' and end time past)
  const { count: missedBreaks } = await admin
    .from('breaks')
    .select('id', { count: 'exact', head: true })
    .eq('shift_id', shiftId)
    .eq('status', 'missed')

  // Count safety meetings attended vs missed
  const clockIn  = new Date(shift.clock_in as string)
  const clockOut = shift.clock_out ? new Date(shift.clock_out as string) : new Date()
  const { data: attendances } = await admin
    .from('safety_meeting_attendances')
    .select('attended')
    .eq('employee_id', shift.employee_id)
    .gte('attended_at', clockIn.toISOString())
    .lte('attended_at', clockOut.toISOString())

  const safetyAttended = (attendances ?? []).filter((a: { attended: boolean }) => a.attended).length
  const safetyMissed   = (attendances ?? []).filter((a: { attended: boolean }) => !a.attended).length

  // Attendance status based on clock-in time vs scheduled start
  const { data: sched } = await admin
    .from('shift_schedules')
    .select('start_time')
    .eq('shift_id', shiftId)
    .maybeSingle()

  let attendanceStatus: 'present' | 'late' | 'absent' | 'excused' = 'present'
  if (sched?.start_time) {
    const scheduledStart = new Date(sched.start_time)
    const lateByMs = clockIn.getTime() - scheduledStart.getTime()
    if (lateByMs > 10 * 60 * 1000) attendanceStatus = 'late'  // >10 min late
  }

  // Upsert snapshot (replace if already exists for this shift)
  const { error } = await admin.from('driver_performance_snapshots').upsert({
    employee_id:               shift.employee_id,
    snapshot_date:             shiftDate,
    shift_id:                  shiftId,
    attendance_status:         attendanceStatus,
    missed_breaks_count:       missedBreaks ?? 0,
    safety_meetings_attended:  safetyAttended,
    safety_meetings_missed:    safetyMissed,
  }, { onConflict: 'employee_id,snapshot_date,shift_id' })

  if (error) return { error: error.message }
  return { success: true }
}
