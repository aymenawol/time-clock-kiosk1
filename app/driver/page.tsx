import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import DriverDashboard from './driver-dashboard'

export const dynamic = 'force-dynamic'

export default async function DriverPage() {
  const { user } = await getServerUser()
  const supabase = await createSupabaseServerClient()

  const today = new Date().toISOString().slice(0, 10)

  // Get employee record for current user
  const { data: employee } = await supabase
    .from('employees')
    .select('id, first_name, last_name, seniority_number')
    .eq('auth_user_id', user?.id)
    .single()

  // Get today's active shift with breaks
  const { data: shift } = employee
    ? await supabase
        .from('shifts')
        .select(`
          *,
          bus:bus_id(id, bus_number, bus_type, fuel_level, status),
          tablet:tablet_id(id, tablet_number),
          breaks(*)
        `)
        .eq('employee_id', employee.id)
        .eq('date', today)
        .in('status', ['active', 'scheduled'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  // OT banner
  const { data: otBanner } = await supabase
    .from('ot_banner')
    .select('*')
    .eq('id', 'singleton')
    .maybeSingle()

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <DriverDashboard employee={employee} shift={shift} otBanner={otBanner} />
    </div>
  )
}
