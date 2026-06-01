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
      .select('id, bus_number, bus_type, fuel_level, status')
      .order('bus_number'),

    supabase
      .from('shifts')
      .select('id, bus_id, employee_id, status, radio_status, actual_start, scheduled_end, buses(id, bus_number, bus_type, fuel_level, status), employees(id, name)')
      .eq('status', 'active'),

    supabase
      .from('latest_bus_positions')
      .select('bus_id, latitude, longitude, speed, heading, recorded_at'),

    supabase
      .from('fatigue_alerts')
      .select('id, employee_id, alert_type, triggered_at, resolved_at, dismissed_at, employees(name)')
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

  const availableBusCount = (buses ?? []).filter(b => b.status === 'ready').length
  const oosBusCount = (buses ?? []).filter(b => ['shopped_dvir', 'maintenance_repair', 'maintenance_pmi', 'safety_hold', 'salvage'].includes(b.status)).length

  // Supabase returns to-one embeds as `buses`/`employees`; reshape into the
  // singular `bus`/`employee` the client component expects.
  const shiftsForClient = (activeShifts ?? []).map((s: Record<string, any>) => ({
    id: s.id, bus_id: s.bus_id, employee_id: s.employee_id,
    status: s.status, radio_status: s.radio_status,
    actual_start: s.actual_start, scheduled_end: s.scheduled_end,
    bus: s.buses ?? null,
    employee: s.employees ?? null,
  }))

  const fatigueForClient = (fatigueAlerts ?? []).map((a: Record<string, any>) => ({
    id: a.id, employee_id: a.employee_id, alert_type: a.alert_type,
    triggered_at: a.triggered_at, resolved_at: a.resolved_at, dismissed_at: a.dismissed_at,
    employees: a.employees ?? null,
  }))

  return (
    <DispatchBoardClient
      activeShifts={shiftsForClient as Parameters<typeof DispatchBoardClient>[0]['activeShifts']}
      buses={(buses ?? []) as Parameters<typeof DispatchBoardClient>[0]['buses']}
      latestPositions={positionMap as Parameters<typeof DispatchBoardClient>[0]['latestPositions']}
      fatigueAlerts={fatigueForClient as Parameters<typeof DispatchBoardClient>[0]['fatigueAlerts']}
      otBanner={otBannerRows?.[0] ?? null}
      availableBusCount={availableBusCount}
      oosBusCount={oosBusCount}
    />
  )
}
