import { createSupabaseServerClient } from '@/lib/supabase-server'
import CountingSheetsReviewClient from './counting-sheets-review-client'

export const dynamic = 'force-dynamic'

export default async function CountingSheetsReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()
  const dateFilter = params.date ?? new Date().toISOString().slice(0, 10)

  const { data: sheets } = await supabase
    .from('counting_sheets')
    .select(`
      id, date, status, submitted_at, start_time, end_time,
      driver:driver_id(id, first_name, last_name, seniority_number),
      bus:bus_id(bus_number, bus_type),
      counting_rows(id, row_order, departure_time, rac, t1, t3, term1, term3_west, term3_east)
    `)
    .eq('date', dateFilter)
    .order('submitted_at', { ascending: false })

  return (
    <div className="p-6">
      <CountingSheetsReviewClient sheets={(sheets as any) ?? []} dateFilter={dateFilter} />
    </div>
  )
}
