import { supabase, Employee, TimeEntry, DviRecord, Timesheet, Vehicle, ActiveClockIn } from './supabase'

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

export async function clockIn(employeeUuid: string): Promise<TimeEntry | null> {
  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      employee_id: employeeUuid,
      clock_in_time: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0]
    })
    .select()
    .single()

  if (error) {
    console.error('Error clocking in:', error)
    return null
  }
  return data
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
    hour12: true
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
