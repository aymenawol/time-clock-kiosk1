import { createSupabaseServerClient } from '@/lib/supabase-server'
import FleetClient from './fleet-client'

export default async function FleetReadinessPage() {
  const supabase = await createSupabaseServerClient()

  const [{ data: buses }, { data: defects }] = await Promise.all([
    supabase
      .from('buses')
      .select('id, bus_number, bus_type, fuel_level, status')
      .order('bus_number'),

    // Open defects come from v2 repair_notes (is_resolved=false), joined to the bus.
    supabase
      .from('repair_notes')
      .select('id, bus_id, defect_category, defect_item, notes, created_at, resolved_at, buses(bus_number)')
      .eq('is_resolved', false)
      .order('created_at', { ascending: false }),
  ])

  const openDefects = (defects ?? []).map((d: Record<string, unknown>) => {
    const bus = d.buses as Record<string, unknown> | null
    const category = (d.defect_category as string) ?? ''
    const item = (d.defect_item as string) ?? ''
    const desc = [category, item].filter(Boolean).join(' — ') || (d.notes as string) || 'Defect'
    return {
      id: d.id as string,
      bus_id: d.bus_id as string,
      bus_number: (bus?.bus_number as string) ?? 'Unknown',
      description: desc,
      created_at: d.created_at as string,
      resolved_at: d.resolved_at as string | null,
    }
  })

  return <FleetClient buses={(buses ?? []) as Parameters<typeof FleetClient>[0]['buses']} openDefects={openDefects} />
}
