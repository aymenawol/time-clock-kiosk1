import { createSupabaseServerClient } from '@/lib/supabase-server'
import DispatchBoardClient from './dispatch-board-client'

export default async function BoardPage() {
  const supabase = await createSupabaseServerClient()

  const [
    { data: buses },
    { data: activeShifts },
    { data: latestPositions },
    { data: fatigueAlerts },
    { data: otBannerRows },
  ] = await Promise.all([
    supabase
      .from('buses')
      .select('id, bus_number, bus_type, fuel_level, battery_level, status')
      .order('bus_number'),

    supabase
      .from('shifts')
      .select('id, bus_id, employee_id, status, radio_status, actual_start, scheduled_end, buses(id, bus_number, bus_type, fuel_level, battery_level, status), employees(id, first_name, last_name)')
      .eq('status', 'active'),

    supabase
      .from('latest_bus_positions')
      .select('bus_id, latitude, longitude, speed, heading, recorded_at'),

    supabase
      .from('fatigue_alerts')
      .select('id, employee_id, alert_type, triggered_at, resolved_at, dismissed_at, employees(first_name, last_name)')
      .is('resolved_at', null)
      .is('dismissed_at', null)
      .order('triggered_at', { ascending: false })
      .limit(50),

    supabase
      .from('ot_banner')
      .select('is_active, message')
      .limit(1),
  ])

  const positionMap = Object.fromEntries(
    (latestPositions ?? []).map(p => [p.bus_id, p])
  )

  const availableBusCount = (buses ?? []).filter(b => b.status === 'available').length
  const oosBusCount = (buses ?? []).filter(b => ['out_of_service', 'safety_hold', 'maintenance'].includes(b.status)).length

  return (
    <DispatchBoardClient
      activeShifts={(activeShifts ?? []) as Parameters<typeof DispatchBoardClient>[0]['activeShifts']}
      buses={(buses ?? []) as Parameters<typeof DispatchBoardClient>[0]['buses']}
      latestPositions={positionMap as Parameters<typeof DispatchBoardClient>[0]['latestPositions']}
      fatigueAlerts={(fatigueAlerts ?? []) as Parameters<typeof DispatchBoardClient>[0]['fatigueAlerts']}
      otBanner={otBannerRows?.[0] ?? null}
      availableBusCount={availableBusCount}
      oosBusCount={oosBusCount}
    />
  )
}
