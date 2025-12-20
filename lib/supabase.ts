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
