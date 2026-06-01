import { createSupabaseServerClient } from '@/lib/supabase-server'
import CoordinatorClient from './coordinator-client'

export const dynamic = 'force-dynamic'

export default async function CoordinatorPage() {
  const supabase = await createSupabaseServerClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: shifts } = await supabase
    .from('shifts')
    .select(`
      id, date, status, scheduled_start, scheduled_end, actual_start, actual_end,
      radio_status, notes,
      employee:employee_id(id, name, seniority_number),
      bus:bus_id(id, bus_number, bus_type, fuel_level, status),
      tablet:tablet_id(id, tablet_number),
      breaks(id, break_number, status, scheduled_start, window_open, window_close, actual_start, actual_end, duration_minutes)
    `)
    .eq('date', today)
    .in('status', ['active', 'scheduled', 'completed'])
    .order('scheduled_start', { ascending: true })

  return <CoordinatorClient initialShifts={(shifts as any) ?? []} today={today} />
}
