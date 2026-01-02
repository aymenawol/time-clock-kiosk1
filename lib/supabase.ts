import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Create a singleton instance, lazily initialized
let supabaseInstance: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase credentials are not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.')
    }
    
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
  }
  return supabaseInstance
}

// For backward compatibility - lazy getter
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as any)[prop]
  }
})

// Types for our database tables
export interface Employee {
  id: string
  employee_id: string
  name: string
  pin: string
  is_active: boolean
  created_at: string
}

export interface TimeEntry {
  id: string
  employee_id: string
  clock_in_time: string
  clock_out_time: string | null
  date: string
  total_hours: number | null
  created_at: string
}

export interface DviRecord {
  id: string
  employee_id: string
  time_entry_id: string | null
  vehicle_id: string | null
  inspection_date: string
  inspection_type: 'pre-trip' | 'post-trip'
  inspection_data: Record<string, any> | null
  notes: string | null
  is_passed: boolean
  created_at: string
}

export interface Timesheet {
  id: string
  employee_id: string
  time_entry_id: string | null
  operator_name: string | null
  bus_number: string | null
  check_in: string | null
  check_out: string | null
  brk_windows: string | null
  entries: Record<string, any>[] | null
  totals: Record<string, any> | null
  date: string
  created_at: string
}

export interface Vehicle {
  id: string
  vehicle_number: string
  vehicle_type: string | null
  is_active: boolean
  created_at: string
}

export interface ActiveClockIn {
  time_entry_id: string
  employee_id: string
  name: string
  clock_in: string
  duration_hours: string
}

// ==================== OPTIONAL FORM TYPES ====================

export interface IncidentReport {
  id: string
  employee_id: string
  employee_name: string
  incident_date: string
  incident_time: string
  incident_location: string
  bus_number: string | null
  supervisor_contacted: string | null
  details: string
  witnesses: string | null
  passenger_name: string | null
  passenger_address: string | null
  passenger_city_state_zip: string | null
  passenger_phone: string | null
  date_completed: string
  time_completed: string
  status: 'pending' | 'reviewed' | 'resolved'
  created_at: string
}

export interface TimeOffRequest {
  id: string
  employee_id: string
  employee_name: string
  mailbox_number: string | null
  start_time: string | null
  submission_date: string
  dates_requested: string[]
  request_type: 'vacation_pto' | 'bereavement' | 'birthday' | 'jury_duty'
  status: 'pending' | 'approved' | 'denied'
  days_available: boolean[]
  operations_manager_signature: string | null
  approved: boolean[]
  vacation_time_available: string | null
  vacation_time_used: string | null
  vacation_time_left: string | null
  pto_time_available: string | null
  pto_time_used: string | null
  pto_time_left: string | null
  birthday_time_available: string | null
  birthday_time_used: string | null
  birthday_time_left: string | null
  unpaid_time: string | null
  payroll_signature: string | null
  created_at: string
}

export interface OvertimeRequest {
  id: string
  employee_id: string
  employee_name: string
  seniority_number: string | null
  time_stamp: string | null
  date_submitted: string
  shift_number: string | null
  shift_date: string | null
  start_time: string | null
  end_time: string | null
  pay_hours: string | null
  dispatcher_name: string | null
  status: 'pending' | 'awarded' | 'not_awarded'
  manager_signature: string | null
  created_at: string
}

export interface FmlaConversionRequest {
  id: string
  employee_id: string
  employee_name: string
  mailbox_number: string | null
  submission_date: string
  dates_to_convert: string[]
  use_vacation_pay: boolean[]
  status: 'pending' | 'approved' | 'denied'
  fmla_approved: boolean[]
  reason_for_disapproval: string | null
  entered_by: string | null
  approved_by: string | null
  created_at: string
}

export interface SafetyMeeting {
  id: string
  date: string
  time: string
  category: 'driver' | 'coordinator' | 'fueler_washer' | 'technician'
}

export interface SafetyMeetingSchedule {
  id: string
  title: string
  month: string
  year: number
  instruction: string
  meetings: SafetyMeeting[]
  is_active: boolean
  share_token: string | null
  created_at: string
  updated_at: string
}

