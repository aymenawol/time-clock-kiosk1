import { createSupabaseServerClient } from '@/lib/supabase-server'
import SignInClient from './sign-in-client'

export const dynamic = 'force-dynamic'

export default async function SignInPage() {
  const supabase = await createSupabaseServerClient()
  const today = new Date().toISOString().slice(0, 10)

  const [driversRes, busesRes, tabletsRes, todayShiftsRes] = await Promise.all([
    supabase
      .from('employees')
      .select('id, first_name, last_name, seniority_number')
      .eq('role', 'driver')
      .eq('status', 'active')
      .order('last_name'),
    supabase
      .from('buses')
      .select('id, bus_number, bus_type, status, fuel_level')
      .eq('is_active', true)
      .in('status', ['ready', 'in_service'])
      .order('bus_number'),
    supabase
      .from('tablets')
      .select('id, tablet_number')
      .eq('is_available', true)
      .order('tablet_number'),
    supabase
      .from('shifts')
      .select(`
        *,
        employee:employee_id(first_name, last_name),
        bus:bus_id(bus_number, bus_type),
        tablet:tablet_id(tablet_number)
      `)
      .eq('date', today)
      .order('created_at', { ascending: false }),
  ])

  return (
    <div className="p-4">
      <SignInClient
        drivers={driversRes.data ?? []}
        buses={busesRes.data ?? []}
        tablets={tabletsRes.data ?? []}
        todayShifts={todayShiftsRes.data ?? []}
        today={today}
      />
    </div>
  )
}
