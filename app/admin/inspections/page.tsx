import { createSupabaseServerClient } from '@/lib/supabase-server'
import InspectionsReviewClient from './inspections-review-client'

export const dynamic = 'force-dynamic'

export default async function AdminInspectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; type?: string; page?: string }>
}) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()
  const dateFilter = params.date ?? new Date().toISOString().slice(0, 10)
  const typeFilter = params.type ?? ''
  const page = parseInt(params.page ?? '1')
  const pageSize = 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('vehicle_inspections')
    .select(`
      id, inspection_type, inspection_date, is_locked, submitted_at, has_defects, damage_drawing,
      driver:driver_id(first_name, last_name),
      bus:bus_id(bus_number),
      inspection_items(id, item_name, passed)
    `, { count: 'exact' })
    .eq('inspection_date', dateFilter)
    .order('submitted_at', { ascending: false })
    .range(from, to)

  if (typeFilter) {
    query = query.eq('inspection_type', typeFilter)
  }

  const { data: inspections, count } = await query

  return (
    <div className="p-6">
      <InspectionsReviewClient
        inspections={(inspections as any) ?? []}
        dateFilter={dateFilter}
        typeFilter={typeFilter}
        page={page}
        pageSize={pageSize}
        total={count ?? 0}
      />
    </div>
  )
}
