import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import DriverDashboard from './driver-dashboard'

export const dynamic = 'force-dynamic'

export default async function DriverPage() {
  const { user } = await getServerUser()
  const supabase = await createSupabaseServerClient()

  const today = new Date().toISOString().slice(0, 10)

  // Employee (needs user.id) and the OT banner (independent) can load together.
  const [{ data: employee }, { data: otBanner }] = await Promise.all([
    supabase
      .from('employees')
      .select('id, name, seniority_number')
      .eq('auth_user_id', user?.id)
      .single(),
    supabase
      .from('ot_banner')
      .select('*')
      .eq('id', 'singleton')
      .maybeSingle(),
  ])

  // Get today's active shift with breaks (depends on the employee row)
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

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <DriverDashboard employee={employee} shift={shift} otBanner={otBanner} />
    </div>
  )
}
