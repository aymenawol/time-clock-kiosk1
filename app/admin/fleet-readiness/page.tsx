import { createSupabaseServerClient } from '@/lib/supabase-server'
import FleetClient from './fleet-client'

export default async function FleetReadinessPage() {
  const supabase = await createSupabaseServerClient()

  const [{ data: buses }, { data: defects }] = await Promise.all([
    supabase
      .from('buses')
      .select('id, bus_number, bus_type, fuel_level, battery_level, status, last_inspection_at')
      .order('bus_number'),

    // Open DVIR defects — dvir_items where resolved_at IS NULL joined with inspection_reports for bus info
    supabase
      .from('dvir_items')
      .select('id, bus_id, description, created_at, resolved_at, inspection_reports(buses(bus_number))')
      .is('resolved_at', null)
      .order('created_at', { ascending: false }),
  ])

  const openDefects = (defects ?? []).map((d: Record<string, unknown>) => {
    const report = d.inspection_reports as Record<string, unknown> | null
    const bus = report?.buses as Record<string, unknown> | null
    return {
      id: d.id as string,
      bus_id: d.bus_id as string,
      bus_number: (bus?.bus_number as string) ?? 'Unknown',
      description: d.description as string,
      created_at: d.created_at as string,
      resolved_at: d.resolved_at as string | null,
    }
  })

  return <FleetClient buses={(buses ?? []) as Parameters<typeof FleetClient>[0]['buses']} openDefects={openDefects} />
}
