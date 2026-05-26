import { createSupabaseServerClient } from '@/lib/supabase-server'
import TechnicianClient from './technician-client'

export const dynamic = 'force-dynamic'

export default async function TechnicianPage() {
  const supabase = await createSupabaseServerClient()

  const [{ data: repairNotes }, { data: buses }] = await Promise.all([
    supabase
      .from('repair_notes')
      .select(`
        id, notes, photo_urls, is_resolved, resolved_at, created_at,
        defect_category, defect_item,
        bus:bus_id(id, bus_number, bus_type, status),
        inspection:inspection_id(id, inspection_type, inspection_date, driver_id)
      `)
      .eq('is_resolved', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('buses')
      .select('id, bus_number, bus_type, status, fuel_level')
      .order('bus_number', { ascending: true }),
  ])

  return (
    <TechnicianClient
      initialRepairNotes={(repairNotes as any) ?? []}
      buses={(buses as any) ?? []}
    />
  )
}
