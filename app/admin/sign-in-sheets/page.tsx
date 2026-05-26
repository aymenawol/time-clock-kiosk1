import { createSupabaseServerClient } from '@/lib/supabase-server'
import SignInSheetsClient from './sign-in-sheets-client'

export const dynamic = 'force-dynamic'

export default async function SignInSheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; page?: string }>
}) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()

  const dateFilter = params.date ?? new Date().toISOString().slice(0, 10)
  const page = parseInt(params.page ?? '1', 10)
  const PAGE_SIZE = 50
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data: shifts, count } = await supabase
    .from('shifts')
    .select(`
      id, date, status, scheduled_start, scheduled_end, actual_start, actual_end, radio_status,
      employee:employee_id(id, first_name, last_name, seniority_number, employee_id),
      bus:bus_id(bus_number, bus_type),
      tablet:tablet_id(tablet_number)
    `, { count: 'exact' })
    .eq('date', dateFilter)
    .order('scheduled_start', { ascending: true })
    .range(from, to)

  return (
    <div className="p-6">
      <SignInSheetsClient
        shifts={(shifts as any) ?? []}
        totalCount={count ?? 0}
        dateFilter={dateFilter}
        page={page}
        pageSize={PAGE_SIZE}
      />
    </div>
  )
}
