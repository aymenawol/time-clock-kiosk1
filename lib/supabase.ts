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

// Role type shared across the system
export type EmployeeRole =
  | 'admin'
  | 'management'
  | 'driver'
  | 'dispatcher'
  | 'coordinator'
  | 'supervisor'
  | 'technician'
  | 'fueler_washer'
  | 'payroll'

export type EmployeeStatus = 'active' | 'on_leave' | 'terminated'

// Types for our database tables
export interface Employee {
  id: string
  employee_id: string
  name: string
  /** @deprecated Use Supabase Auth for credentials */
  pin: string
  is_active: boolean
  created_at: string
  // v2 fields
  auth_user_id: string | null
  email: string | null
  phone: string | null
  hire_date: string | null
  seniority_number: number | null
  department: string | null
  role: EmployeeRole | null
  status: EmployeeStatus
  shift: string | null
  pto_balance: number
  vacation_balance: number
  fmla_balance: number
}

export interface Profile {
  id: string
  employee_id: string | null
  role: EmployeeRole
  is_active: boolean
  created_at: string
  updated_at: string
}

// ── Phase 2 Types ────────────────────────────────────────────────────────────

export type BusStatus =
  | 'ready' | 'in_service' | 'charging' | 'fuel' | 'wash' | 'fuel_wash'
  | 'maintenance_pmi' | 'shopped_dvir' | 'maintenance_repair'
  | 'safety_hold' | 'salvage' | 'training'

export type BusType = 'EV' | 'Diesel'

export interface Bus {
  id: string
  bus_number: string
  vin: string | null
  bus_type: BusType
  status: BusStatus
  fuel_level: number | null
  current_mileage: number | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Tablet {
  id: string
  tablet_number: string
  serial_number: string | null
  is_available: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface BusStatusHistory {
  id: string
  bus_id: string
  from_status: BusStatus | null
  to_status: BusStatus
  changed_by: string | null
  reason: string | null
  fuel_level: number | null
  mileage: number | null
  created_at: string
}

export type ShiftStatus = 'scheduled' | 'active' | 'completed' | 'cancelled'

export interface Shift {
  id: string
  date: string
  employee_id: string
  bus_id: string | null
  tablet_id: string | null
  dispatcher_id: string | null
  scheduled_start: string | null
  scheduled_end: string | null
  actual_start: string | null
  actual_end: string | null
  has_lunch: boolean
  lunch_waiver: boolean
  signature_data: string | null
  total_hours: number | null
  status: ShiftStatus
  radio_status: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type BreakStatus = 'pending' | 'active' | 'completed' | 'missed' | 'overrun'

export interface Break {
  id: string
  shift_id: string
  employee_id: string
  break_number: 1 | 2
  scheduled_start: string | null
  window_open: string | null
  window_close: string | null
  actual_start: string | null
  actual_end: string | null
  duration_minutes: number
  status: BreakStatus
  sms_reminder_sent: boolean
  overrun_alert_sent: boolean
  dispatcher_override_by: string | null
  dispatcher_override_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CountingSheet {
  id: string
  shift_id: string
  date: string
  driver_id: string
  bus_id: string | null
  start_time: string | null
  end_time: string | null
  status: 'draft' | 'submitted'
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export interface CountingRow {
  id: string
  sheet_id: string
  row_order: number
  departure_time: string | null
  rac: number
  t1: number
  t3: number
  term1: number
  term3_west: number
  term3_east: number
  created_at: string
  updated_at: string
}

export interface VehicleInspection {
  id: string
  shift_id: string
  inspection_type: 'pre_trip' | 'post_trip'
  bus_id: string | null
  driver_id: string
  inspection_date: string
  start_time: string | null
  end_time: string | null
  beginning_mileage: number | null
  ending_mileage: number | null
  miles_driven: number | null
  time_worked: string | null
  damage_drawing: DamageDrawingPath[]
  has_defects: boolean
  is_locked: boolean
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export interface DamageDrawingPath {
  tool: 'pen' | 'marker' | 'highlighter'
  color: string
  paths: { d: string }[]
}

export interface InspectionItem {
  id: string
  inspection_id: string
  category: string
  item_name: string
  is_ok: boolean | null
  notes: string | null
  created_at: string
}

export interface RepairNote {
  id: string
  bus_id: string
  inspection_id: string | null
  technician_id: string | null
  defect_category: string | null
  defect_item: string | null
  notes: string
  photo_urls: string[]
  is_resolved: boolean
  resolved_at: string | null
  created_at: string
  updated_at: string
}

// Bus status display helpers
export const BUS_STATUS_LABELS: Record<BusStatus, string> = {
  ready:               'Ready',
  in_service:          'In Service',
  charging:            'Charging',
  fuel:                'Fueling',
  wash:                'Wash',
  fuel_wash:           'Fuel + Wash',
  maintenance_pmi:     'PMI',
  shopped_dvir:        'Shopped / DVIR',
  maintenance_repair:  'Repair',
  safety_hold:         'Safety Hold',
  salvage:             'Salvage',
  training:            'Training',
}

export const BUS_STATUS_COLOR: Record<BusStatus, string> = {
  ready:               'bg-green-900/60 border-green-600 text-green-300',
  in_service:          'bg-blue-900/60 border-blue-600 text-blue-300',
  charging:            'bg-yellow-900/60 border-yellow-600 text-yellow-300',
  fuel:                'bg-yellow-900/60 border-yellow-600 text-yellow-300',
  wash:                'bg-yellow-900/60 border-yellow-600 text-yellow-300',
  fuel_wash:           'bg-amber-900/60 border-amber-600 text-amber-300',
  maintenance_pmi:     'bg-red-900/60 border-red-600 text-red-300',
  shopped_dvir:        'bg-red-900/60 border-red-600 text-red-300',
  maintenance_repair:  'bg-red-900/60 border-red-600 text-red-300',
  safety_hold:         'bg-purple-900/60 border-purple-600 text-purple-300',
  salvage:             'bg-gray-800 border-gray-600 text-gray-400',
  training:            'bg-yellow-900/60 border-yellow-600 text-yellow-300',
}

export const INSPECTION_CHECKLIST: { category: string; items: string[] }[] = [
  { category: 'Exterior',          items: ['Body damage', 'Mirrors intact', 'Windows unobstructed', 'Doors operate properly'] },
  { category: 'Tires',             items: ['Adequate tread depth', 'No visible damage', 'Properly inflated', 'No wheel leaks'] },
  { category: 'Lights',            items: ['Headlights', 'Taillights', 'Brake lights', 'Turn signals', 'Hazard lights', 'Interior lights'] },
  { category: 'Brake Systems',     items: ['Brake pedal firm', 'Air brake gauge normal', 'No unusual brake sounds'] },
  { category: 'Steering',          items: ['Steering wheel free play normal', 'No pulling or wandering'] },
  { category: 'Gauges',            items: ['Speedometer working', 'Fuel/charge gauge working', 'Temperature normal', 'Oil pressure normal'] },
  { category: 'Interior',          items: ['Seats secure and undamaged', 'Seat belts functional', 'Handrails secure', 'Floor clean and unobstructed'] },
  { category: 'Passenger Ramp',    items: ['Ramp deploys/retracts properly', 'Ramp surface non-slip', 'No damage to ramp mechanism'] },
  { category: 'Parking Brake',     items: ['Parking brake holds vehicle', 'Parking brake releases fully'] },
  { category: 'Safety Equipment',  items: ['Fire extinguisher present and charged', 'First aid kit present', 'Emergency triangles present', 'Emergency exits unobstructed'] },
  { category: 'Mirrors',           items: ['All mirrors properly adjusted', 'No cracks or obstructions'] },
]

export interface AppSettings {
  id: 'singleton'
  break_rules: {
    default_break_duration_minutes: number
    break_window_start_hours: number
    break_window_end_hours: number
    missed_break_alert_minutes: number
    allow_dispatcher_override: boolean
  }
  overtime_rules: {
    daily_ot_threshold_hours: number
    weekly_ot_threshold_hours: number
    ot_multiplier: number
    award_method: string
    bid_cycle_months: number
  }
  notification_preferences: {
    roles_notified_on_clock_in: EmployeeRole[]
    roles_notified_on_incident: EmployeeRole[]
    roles_notified_on_time_off: EmployeeRole[]
    roles_notified_on_overtime: EmployeeRole[]
    roles_notified_on_fmla: EmployeeRole[]
  }
  created_at: string
  updated_at: string
}

// Legacy v1 row types (time_entries, dvi_records, timesheets, vehicles,
// active_clock_ins, and the 4 flat form tables) were removed in migration
// 20260601000005_v2_phase11_drop_legacy_tables.sql. The v2 equivalents are
// shifts / vehicle_inspections / buses / form_submissions.

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

// ── Phase 3 Types ────────────────────────────────────────────────────────────

export type BidCycleStatus = 'draft' | 'published' | 'locked' | 'awarded'
export type RouteType = 'full_time' | 'employee_shuttle' | 'part_time'

export interface ShiftBidCycle {
  id: string
  name: string
  description: string | null
  start_date: string
  end_date: string
  submission_open_at: string | null
  submission_close_at: string | null
  status: BidCycleStatus
  created_by: string | null
  awarded_at: string | null
  awarded_by: string | null
  created_at: string
  updated_at: string
}

export interface ShiftBidSlot {
  id: string
  cycle_id: string
  bid_number: number
  shift_start: string
  shift_end: string
  report_time: string
  days_sun: boolean; days_mon: boolean; days_tue: boolean; days_wed: boolean
  days_thu: boolean; days_fri: boolean; days_sat: boolean
  route_type: RouteType
  max_drivers: number
  notes: string | null
  created_at: string
}

export interface ShiftBidSubmission {
  id: string
  cycle_id: string
  employee_id: string
  preferences: { slot_id: string; rank: 1 | 2 | 3 }[]
  submitted_at: string
  updated_at: string
}

export interface ShiftBidAward {
  id: string
  cycle_id: string
  employee_id: string
  slot_id: string
  preference_rank: 1 | 2 | 3 | null
  award_method: 'seniority' | 'manual' | 'auto_unsubmitted'
  override_reason: string | null
  awarded_at: string
  awarded_by: string | null
  notification_sent: boolean
}

export type OtShiftStatus = 'open' | 'closed' | 'awarded' | 'cancelled'

export interface OvertimeShift {
  id: string
  date: string
  start_time: string
  duration_hours: number
  slots_available: number
  description: string | null
  posted_by: string | null
  bid_close_at: string | null
  status: OtShiftStatus
  created_at: string
  updated_at: string
}

export interface OvertimeBid {
  id: string
  overtime_shift_id: string
  employee_id: string
  submitted_at: string
}

export interface OvertimeAward {
  id: string
  overtime_shift_id: string
  employee_id: string
  award_method: 'seniority' | 'manual'
  awarded_at: string
  awarded_by: string | null
  notified: boolean
}

export interface OffDayRequest {
  id: string
  employee_id: string
  requested_date: string
  posted_by: string | null
  message: string | null
  response: 'pending' | 'accepted' | 'declined' | 'custom'
  available_start_time: string | null
  available_hours: number | null
  custom_availability: string | null
  responded_at: string | null
  created_at: string
}

export interface OtBanner {
  id: 'singleton'
  is_active: boolean
  message: string
  updated_by: string | null
  updated_at: string
}

export type FormType = 'time_off' | 'bid_vacation_change' | 'incident_report' | 'fmla_conversion' | 'resignation'
export type FormStatus = 'submitted' | 'under_review' | 'approved' | 'denied' | 'returned'

export interface FormSubmission {
  id: string
  employee_id: string
  form_type: FormType
  version: number
  payload: Record<string, any>
  status: FormStatus
  submitted_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  reviewer_comments: string | null
  parent_id: string | null
  created_at: string
  updated_at: string
}

export interface FormAcknowledgement {
  id: string
  submission_id: string
  employee_id: string
  acknowledged_at: string
}

export type SafetyMeetingStatus = 'scheduled' | 'completed' | 'cancelled'
export type SafetyMeetingDept = 'drivers' | 'coordinators' | 'technicians' | 'fueler_washer' | 'all'

export interface SafetyMeetingV3 {
  id: string
  title: string
  department: SafetyMeetingDept
  scheduled_date: string
  scheduled_time: string
  location: string | null
  notes: string | null
  status: SafetyMeetingStatus
  created_by: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface SafetyMeetingSignin {
  id: string
  meeting_id: string
  employee_id: string
  signed_in_at: string
  attendance_status: 'present' | 'late' | 'absent' | 'excused'
  added_by_admin: boolean
  admin_note: string | null
}

export type NotificationType =
  | 'info' | 'overtime_shift' | 'break_overdue' | 'emergency_alert'
  | 'form_approved' | 'form_denied' | 'form_returned' | 'form_submitted'
  | 'bid_awarded' | 'shift_bid_open' | 'safety_meeting'
  | 'wheelchair_request' | 'maintenance_reminder' | 'resignation_approved'
  | 'chat_message'

export interface AppNotification {
  id: string
  user_id: string
  employee_id: string | null
  type: NotificationType
  title: string
  body: string | null
  data: Record<string, any>
  channels: string[]
  is_read: boolean
  read_at: string | null
  created_at: string
}

export const FORM_TYPE_LABELS: Record<FormType, string> = {
  time_off:             'Time Off Request',
  bid_vacation_change:  'Bid/Vacation Change',
  incident_report:      'Incident Report',
  fmla_conversion:      'FMLA Conversion',
  resignation:          'Resignation Letter',
}

export const FORM_STATUS_COLOR: Record<FormStatus, string> = {
  submitted:     'bg-blue-900/60 text-blue-300 border-blue-700',
  under_review:  'bg-yellow-900/60 text-yellow-300 border-yellow-700',
  approved:      'bg-green-900/60 text-green-300 border-green-700',
  denied:        'bg-red-900/60 text-red-300 border-red-700',
  returned:      'bg-orange-900/60 text-orange-300 border-orange-700',
}

export const BID_CYCLE_STATUS_COLOR: Record<BidCycleStatus, string> = {
  draft:      'bg-gray-800 text-gray-400 border-gray-700',
  published:  'bg-blue-900/60 text-blue-300 border-blue-700',
  locked:     'bg-yellow-900/60 text-yellow-300 border-yellow-700',
  awarded:    'bg-green-900/60 text-green-300 border-green-700',
}

export const ROUTE_TYPE_LABELS: Record<RouteType, string> = {
  full_time:         'Full Time',
  employee_shuttle:  'Employee Shuttle',
  part_time:         'Part Time',
}
