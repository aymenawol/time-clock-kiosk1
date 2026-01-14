import { supabase, Employee, TimeEntry, DviRecord, Timesheet, Vehicle, ActiveClockIn, IncidentReport, TimeOffRequest, OvertimeRequest, FmlaConversionRequest, SafetyMeetingSchedule, SafetyMeeting } from './supabase'

// ==================== EMPLOYEE FUNCTIONS ====================

export async function getEmployeeByEmployeeId(employeeId: string): Promise<Employee | null> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('is_active', true)
    .single()

  if (error) {
    console.error('Error fetching employee:', error)
    // Only throw on actual errors, not "not found"
    if (error.code !== 'PGRST116') {
      throw new Error(`Database error: ${error.message}`)
    }
    return null
  }
  return data
}

// ==================== TIME ENTRY FUNCTIONS ====================

export async function getCurrentTimeEntry(employeeUuid: string): Promise<TimeEntry | null> {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .eq('employee_id', employeeUuid)
    .is('clock_out_time', null)
    .order('clock_in_time', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Error fetching current time entry:', error)
  }
  return data || null
}

export async function clockIn(employeeUuid: string, lunchWaiver: boolean = false): Promise<TimeEntry | null> {
  const clockInTime = new Date()
  // Calculate expected clock out: 8 hours if lunch waiver, 8.5 hours otherwise
  const hoursToAdd = lunchWaiver ? 8 : 8.5
  const expectedClockOut = new Date(clockInTime.getTime() + hoursToAdd * 60 * 60 * 1000)

  // Try with lunch_waiver fields first, fall back to basic insert if columns don't exist
  let result = await supabase
    .from('time_entries')
    .insert({
      employee_id: employeeUuid,
      clock_in_time: clockInTime.toISOString(),
      date: clockInTime.toISOString().split('T')[0],
      lunch_waiver: lunchWaiver,
      expected_clock_out: expectedClockOut.toISOString()
    })
    .select()
    .single()

  // If error (likely missing columns), try without lunch waiver fields
  if (result.error) {
    console.warn('Lunch waiver columns may not exist, trying basic insert:', result.error.message)
    result = await supabase
      .from('time_entries')
      .insert({
        employee_id: employeeUuid,
        clock_in_time: clockInTime.toISOString(),
        date: clockInTime.toISOString().split('T')[0]
      })
      .select()
      .single()
  }

  if (result.error) {
    console.error('Error clocking in:', result.error)
    return null
  }
  
  // Add lunch waiver info to the returned data even if not in DB
  return {
    ...result.data,
    lunch_waiver: lunchWaiver,
    expected_clock_out: expectedClockOut.toISOString()
  }
}

export async function clockOut(timeEntryId: string): Promise<TimeEntry | null> {
  const clockOutTime = new Date()
  
  // First get the clock in time to calculate total hours
  const { data: entry } = await supabase
    .from('time_entries')
    .select('clock_in_time')
    .eq('id', timeEntryId)
    .single()

  if (!entry) return null

  const clockInTime = new Date(entry.clock_in_time)
  const totalHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60)

  const { data, error } = await supabase
    .from('time_entries')
    .update({
      clock_out_time: clockOutTime.toISOString(),
      total_hours: Math.round(totalHours * 100) / 100 // Round to 2 decimal places
    })
    .eq('id', timeEntryId)
    .select()
    .single()

  if (error) {
    console.error('Error clocking out:', error)
    return null
  }
  return data
}

// ==================== DVI FUNCTIONS ====================

export async function getDviForTimeEntry(timeEntryId: string): Promise<DviRecord | null> {
  const { data, error } = await supabase
    .from('dvi_records')
    .select('*')
    .eq('time_entry_id', timeEntryId)
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching DVI record:', error)
  }
  return data || null
}

export async function submitDvi(
  employeeUuid: string,
  timeEntryId: string,
  dviData: {
    vehicle_id?: string
    inspection_type?: 'pre-trip' | 'post-trip'
    inspection_data: Record<string, any>
    notes?: string
    is_passed: boolean
  }
): Promise<DviRecord | null> {
  const { data, error } = await supabase
    .from('dvi_records')
    .insert({
      employee_id: employeeUuid,
      time_entry_id: timeEntryId,
      vehicle_id: dviData.vehicle_id,
      inspection_type: dviData.inspection_type || 'pre-trip',
      inspection_data: dviData.inspection_data,
      notes: dviData.notes,
      is_passed: dviData.is_passed,
      inspection_date: new Date().toISOString()
    })
    .select()
    .single()

  if (error) {
    console.error('Error submitting DVI:', error)
    return null
  }
  return data
}

// ==================== TIMESHEET FUNCTIONS ====================

export async function getTimesheetForTimeEntry(timeEntryId: string): Promise<Timesheet | null> {
  const { data, error } = await supabase
    .from('timesheets')
    .select('*')
    .eq('time_entry_id', timeEntryId)
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching timesheet record:', error)
  }
  return data || null
}

export async function submitTimesheet(
  employeeUuid: string,
  timeEntryId: string | null,
  timesheetData: {
    operator: string
    busNumber: string
    entries: Array<{
      workOrder: string
      description: string
      straightTime: string
      overTime: string
      totalHours: string
    }>
    totals: {
      straightTime: string
      overTime: string
      totalHours: string
    }
  }
): Promise<Timesheet | null> {
  const { data, error } = await supabase
    .from('timesheets')
    .insert({
      employee_id: employeeUuid,
      time_entry_id: timeEntryId,
      operator_name: timesheetData.operator,
      bus_number: timesheetData.busNumber,
      entries: timesheetData.entries,
      totals: timesheetData.totals,
      date: new Date().toISOString().split('T')[0]
    })
    .select()
    .single()

  if (error) {
    console.error('Error submitting timesheet:', error)
    return null
  }
  return data
}

export async function getTimesheets(employeeId?: string, startDate?: string, endDate?: string): Promise<Timesheet[]> {
  let query = supabase
    .from('timesheets')
    .select(`
      *,
      employees(name, employee_id)
    `)
    .order('created_at', { ascending: false })

  if (employeeId) {
    query = query.eq('employee_id', employeeId)
  }
  if (startDate) {
    query = query.gte('date', startDate)
  }
  if (endDate) {
    query = query.lte('date', endDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching timesheets:', error)
    return []
  }
  return data || []
}

// ==================== ADMIN FUNCTIONS ====================

export async function getActiveClockIns(): Promise<ActiveClockIn[]> {
  const { data, error } = await supabase
    .from('active_clock_ins')
    .select('*')

  if (error) {
    console.error('Error fetching active clock-ins:', error)
    return []
  }
  return data || []
}

export async function getAllEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('name')

  if (error) {
    console.error('Error fetching all employees:', error)
    return []
  }
  return data || []
}

export async function createEmployee(employeeData: {
  employee_id: string
  name: string
  pin: string
  is_active?: boolean
}): Promise<Employee | null> {
  const { data, error } = await supabase
    .from('employees')
    .insert({
      ...employeeData,
      is_active: employeeData.is_active ?? true
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating employee:', error)
    return null
  }
  return data
}

export async function updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee | null> {
  const { data, error } = await supabase
    .from('employees')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating employee:', error)
    return null
  }
  return data
}

export async function getDVIRecords(startDate?: string, endDate?: string): Promise<DviRecord[]> {
  let query = supabase
    .from('dvi_records')
    .select(`
      *,
      employees(name, employee_id)
    `)
    .order('created_at', { ascending: false })

  if (startDate) {
    query = query.gte('inspection_date', startDate)
  }
  if (endDate) {
    query = query.lte('inspection_date', endDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching DVI records:', error)
    return []
  }
  return data || []
}

// ==================== VEHICLE FUNCTIONS ====================

export async function getActiveVehicles(): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('is_active', true)
    .order('vehicle_number')

  if (error) {
    console.error('Error fetching vehicles:', error)
    return []
  }
  return data || []
}

// ==================== HELPER FUNCTIONS ====================

export function formatClockTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

export async function getEmployeeStatus(employeeId: string) {
  const employee = await getEmployeeByEmployeeId(employeeId)
  if (!employee) return null

  const currentTimeEntry = await getCurrentTimeEntry(employee.id)
  const isClockedIn = !!currentTimeEntry
  
  let dviCompleted = false
  if (currentTimeEntry) {
    const dvi = await getDviForTimeEntry(currentTimeEntry.id)
    dviCompleted = !!dvi
  }

  return {
    employee,
    currentTimeEntry,
    isClockedIn,
    dviCompleted,
    clockInTime: currentTimeEntry ? formatClockTime(currentTimeEntry.clock_in_time) : null
  }
}

// ==================== INCIDENT REPORT FUNCTIONS ====================

export async function submitIncidentReport(
  employeeUuid: string,
  reportData: {
    employee_name: string
    incident_date: string
    incident_time: string
    incident_location: string
    bus_number?: string
    supervisor_contacted?: string
    details: string
    witnesses?: string
    passenger_name?: string
    passenger_address?: string
    passenger_city_state_zip?: string
    passenger_phone?: string
  }
): Promise<IncidentReport | null> {
  const now = new Date()
  const { data, error } = await supabase
    .from('incident_reports')
    .insert({
      employee_id: employeeUuid,
      employee_name: reportData.employee_name,
      incident_date: reportData.incident_date,
      incident_time: reportData.incident_time,
      incident_location: reportData.incident_location,
      bus_number: reportData.bus_number || null,
      supervisor_contacted: reportData.supervisor_contacted || null,
      details: reportData.details,
      witnesses: reportData.witnesses || null,
      passenger_name: reportData.passenger_name || null,
      passenger_address: reportData.passenger_address || null,
      passenger_city_state_zip: reportData.passenger_city_state_zip || null,
      passenger_phone: reportData.passenger_phone || null,
      date_completed: now.toISOString().split('T')[0],
      time_completed: now.toTimeString().split(' ')[0],
      status: 'pending'
    })
    .select()
    .single()

  if (error) {
    console.error('Error submitting incident report:', error)
    return null
  }
  return data
}

export async function getIncidentReports(startDate?: string, endDate?: string): Promise<IncidentReport[]> {
  let query = supabase
    .from('incident_reports')
    .select('*')
    .order('created_at', { ascending: false })

  if (startDate) {
    query = query.gte('incident_date', startDate)
  }
  if (endDate) {
    query = query.lte('incident_date', endDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching incident reports:', error)
    return []
  }
  return data || []
}

export async function updateIncidentReportStatus(id: string, status: 'pending' | 'reviewed' | 'resolved'): Promise<boolean> {
  const { error } = await supabase
    .from('incident_reports')
    .update({ status })
    .eq('id', id)

  if (error) {
    console.error('Error updating incident report status:', error)
    return false
  }
  return true
}

// ==================== TIME OFF REQUEST FUNCTIONS ====================

export async function submitTimeOffRequest(
  employeeUuid: string,
  requestData: {
    employee_name: string
    mailbox_number?: string
    start_time?: string
    dates_requested: string[]
    request_type: 'vacation_pto' | 'bereavement' | 'birthday' | 'jury_duty'
  }
): Promise<TimeOffRequest | null> {
  const { data, error } = await supabase
    .from('time_off_requests')
    .insert({
      employee_id: employeeUuid,
      employee_name: requestData.employee_name,
      mailbox_number: requestData.mailbox_number || null,
      start_time: requestData.start_time || null,
      submission_date: new Date().toISOString().split('T')[0],
      dates_requested: requestData.dates_requested,
      request_type: requestData.request_type,
      status: 'pending',
      days_available: [],
      approved: []
    })
    .select()
    .single()

  if (error) {
    console.error('Error submitting time off request:', error)
    return null
  }
  return data
}

export async function getTimeOffRequests(startDate?: string, endDate?: string): Promise<TimeOffRequest[]> {
  let query = supabase
    .from('time_off_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (startDate) {
    query = query.gte('submission_date', startDate)
  }
  if (endDate) {
    query = query.lte('submission_date', endDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching time off requests:', error)
    return []
  }
  return data || []
}

export async function updateTimeOffRequestStatus(id: string, status: 'pending' | 'approved' | 'denied'): Promise<boolean> {
  const { error } = await supabase
    .from('time_off_requests')
    .update({ status })
    .eq('id', id)

  if (error) {
    console.error('Error updating time off request status:', error)
    return false
  }
  return true
}

// ==================== OVERTIME REQUEST FUNCTIONS ====================

export async function submitOvertimeRequest(
  employeeUuid: string,
  requestData: {
    employee_name: string
    seniority_number?: string
    shift_number?: string
    shift_date?: string
    start_time?: string
    end_time?: string
    pay_hours?: string
    dispatcher_name?: string
  }
): Promise<OvertimeRequest | null> {
  const { data, error } = await supabase
    .from('overtime_requests')
    .insert({
      employee_id: employeeUuid,
      employee_name: requestData.employee_name,
      seniority_number: requestData.seniority_number || null,
      time_stamp: new Date().toISOString(),
      date_submitted: new Date().toISOString().split('T')[0],
      shift_number: requestData.shift_number || null,
      shift_date: requestData.shift_date || null,
      start_time: requestData.start_time || null,
      end_time: requestData.end_time || null,
      pay_hours: requestData.pay_hours || null,
      dispatcher_name: requestData.dispatcher_name || null,
      status: 'pending'
    })
    .select()
    .single()

  if (error) {
    console.error('Error submitting overtime request:', error)
    return null
  }
  return data
}

export async function getOvertimeRequests(startDate?: string, endDate?: string): Promise<OvertimeRequest[]> {
  let query = supabase
    .from('overtime_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (startDate) {
    query = query.gte('date_submitted', startDate)
  }
  if (endDate) {
    query = query.lte('date_submitted', endDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching overtime requests:', error)
    return []
  }
  return data || []
}

export async function updateOvertimeRequestStatus(id: string, status: 'pending' | 'awarded' | 'not_awarded'): Promise<boolean> {
  const { error } = await supabase
    .from('overtime_requests')
    .update({ status })
    .eq('id', id)

  if (error) {
    console.error('Error updating overtime request status:', error)
    return false
  }
  return true
}

// ==================== FMLA CONVERSION FUNCTIONS ====================

export async function submitFmlaConversion(
  employeeUuid: string,
  requestData: {
    employee_name: string
    mailbox_number?: string
    dates_to_convert: string[]
    use_vacation_pay: boolean[]
  }
): Promise<FmlaConversionRequest | null> {
  const { data, error } = await supabase
    .from('fmla_conversions')
    .insert({
      employee_id: employeeUuid,
      employee_name: requestData.employee_name,
      mailbox_number: requestData.mailbox_number || null,
      submission_date: new Date().toISOString().split('T')[0],
      dates_to_convert: requestData.dates_to_convert,
      use_vacation_pay: requestData.use_vacation_pay,
      status: 'pending',
      fmla_approved: []
    })
    .select()
    .single()

  if (error) {
    console.error('Error submitting FMLA conversion:', error)
    return null
  }
  return data
}

export async function getFmlaConversions(startDate?: string, endDate?: string): Promise<FmlaConversionRequest[]> {
  let query = supabase
    .from('fmla_conversions')
    .select('*')
    .order('created_at', { ascending: false })

  if (startDate) {
    query = query.gte('submission_date', startDate)
  }
  if (endDate) {
    query = query.lte('submission_date', endDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching FMLA conversions:', error)
    return []
  }
  return data || []
}

export async function updateFmlaConversionStatus(id: string, status: 'pending' | 'approved' | 'denied'): Promise<boolean> {
  const { error } = await supabase
    .from('fmla_conversions')
    .update({ status })
    .eq('id', id)

  if (error) {
    console.error('Error updating FMLA conversion status:', error)
    return false
  }
  return true
}

// ==================== SAFETY MEETING SCHEDULE FUNCTIONS ====================

export async function getSafetyMeetingSchedules(): Promise<SafetyMeetingSchedule[]> {
  const { data, error } = await supabase
    .from('safety_meeting_schedules')
    .select('*')
    .eq('is_active', true)
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  if (error) {
    console.error('Error fetching safety meeting schedules:', error)
    return []
  }
  return data || []
}

export async function getSafetyMeetingScheduleById(id: string): Promise<SafetyMeetingSchedule | null> {
  const { data, error } = await supabase
    .from('safety_meeting_schedules')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching safety meeting schedule:', error)
    return null
  }
  return data
}

export async function getSafetyMeetingScheduleByShareToken(shareToken: string): Promise<SafetyMeetingSchedule | null> {
  const { data, error } = await supabase
    .from('safety_meeting_schedules')
    .select('*')
    .eq('share_token', shareToken)
    .eq('is_active', true)
    .single()

  if (error) {
    console.error('Error fetching safety meeting schedule by share token:', error)
    return null
  }
  return data
}

export async function createSafetyMeetingSchedule(scheduleData: {
  title: string
  month: string
  year: number
  instruction: string
  meetings: SafetyMeeting[]
}): Promise<SafetyMeetingSchedule | null> {
  // Generate a unique share token
  const shareToken = `${scheduleData.month.toLowerCase().substring(0, 3)}${scheduleData.year}-${Math.random().toString(36).substring(2, 8)}`

  const { data, error } = await supabase
    .from('safety_meeting_schedules')
    .insert({
      title: scheduleData.title,
      month: scheduleData.month,
      year: scheduleData.year,
      instruction: scheduleData.instruction,
      meetings: scheduleData.meetings,
      share_token: shareToken,
      is_active: true
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating safety meeting schedule:', error)
    return null
  }
  return data
}

export async function updateSafetyMeetingSchedule(id: string, scheduleData: {
  title?: string
  month?: string
  year?: number
  instruction?: string
  meetings?: SafetyMeeting[]
}): Promise<SafetyMeetingSchedule | null> {
  const { data, error } = await supabase
    .from('safety_meeting_schedules')
    .update(scheduleData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating safety meeting schedule:', error)
    return null
  }
  return data
}

export async function deleteSafetyMeetingSchedule(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('safety_meeting_schedules')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting safety meeting schedule:', error)
    return false
  }
  return true
}

export async function generateNewShareToken(id: string): Promise<string | null> {
  const { data: schedule } = await supabase
    .from('safety_meeting_schedules')
    .select('month, year')
    .eq('id', id)
    .single()

  if (!schedule) return null

  const shareToken = `${schedule.month.toLowerCase().substring(0, 3)}${schedule.year}-${Math.random().toString(36).substring(2, 8)}`

  const { error } = await supabase
    .from('safety_meeting_schedules')
    .update({ share_token: shareToken })
    .eq('id', id)

  if (error) {
    console.error('Error generating new share token:', error)
    return null
  }
  return shareToken
}
