import { createSupabaseServerClient } from '@/lib/supabase-server'
import DispatcherClient from './dispatcher-client'

export const dynamic = 'force-dynamic'

export default async function DispatcherPage() {
  const supabase = await createSupabaseServerClient()
  const today = new Date().toISOString().slice(0, 10)

  const [shiftsRes, busesRes, tabletsRes] = await Promise.all([
    supabase
      .from('shifts')
      .select(`
        *,
        employee:employee_id(id, first_name, last_name, seniority_number),
        bus:bus_id(id, bus_number, bus_type, fuel_level),
        tablet:tablet_id(id, tablet_number),
        breaks(*)
      `)
      .eq('date', today)
      .in('status', ['scheduled', 'active'])
      .order('scheduled_start', { ascending: true }),
    supabase
      .from('buses')
      .select('id, bus_number, bus_type, status, fuel_level')
      .eq('is_active', true)
      .order('bus_number'),
    supabase
      .from('tablets')
      .select('id, tablet_number, is_available')
      .eq('is_available', true)
      .order('tablet_number'),
  ])

  return (
    <div className="p-4">
      <DispatcherClient
        initialShifts={shiftsRes.data ?? []}
        initialBuses={busesRes.data ?? []}
        availableTablets={tabletsRes.data ?? []}
        today={today}
      />
    </div>
  )
}
