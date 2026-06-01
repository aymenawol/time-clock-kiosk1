import { createSupabaseServerClient } from '@/lib/supabase-server'
import SupervisorClient from './supervisor-client'

export const dynamic = 'force-dynamic'

export default async function SupervisorPage() {
  const supabase = await createSupabaseServerClient()
  const today = new Date().toISOString().slice(0, 10)

  const [shiftsRes, fleetRes, openDefectsRes] = await Promise.all([
    supabase
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
      .order('scheduled_start', { ascending: true }),
    supabase
      .from('buses')
      .select('id, bus_number, bus_type, status, fuel_level')
      .eq('is_active', true)
      .order('bus_number'),
    supabase
      .from('repair_notes')
      .select('id, bus_id, defect_category, defect_item, notes, created_at, buses(bus_number)')
      .eq('is_resolved', false)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return (
    <SupervisorClient
      initialShifts={(shiftsRes.data as any) ?? []}
      fleet={(fleetRes.data as any) ?? []}
      openDefects={(openDefectsRes.data as any) ?? []}
      today={today}
    />
  )
}
