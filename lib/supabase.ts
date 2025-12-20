import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Create a singleton instance, but only if we have the required environment variables
let supabaseInstance: SupabaseClient | null = null

export const supabase = (() => {
  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a dummy client during build time - this prevents build errors
    // The actual client will be created at runtime when env vars are available
    if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
      console.warn('Supabase credentials not available during build')
    }
  }
  
  if (!supabaseInstance && supabaseUrl && supabaseAnonKey) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
  }
  
  return supabaseInstance || createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder')
})()

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
