import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import AdminReportsClient from './reports-client'
import { fetchReport, isReportTab, REPORTS_PAGE_SIZE, type ReportTab } from './report-data'

export const dynamic = 'force-dynamic'

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>
}) {
  const { user } = await getServerUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const tab: ReportTab = isReportTab(params.tab) ? params.tab : 'hours'
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const from = (page - 1) * REPORTS_PAGE_SIZE
  const to = from + REPORTS_PAGE_SIZE - 1

  const supabase = await createSupabaseServerClient()
  const { rows, count } = await fetchReport(supabase, tab, { from, to })

  return (
    <AdminReportsClient
      tab={tab}
      rows={rows}
      totalCount={count}
      page={page}
      pageSize={REPORTS_PAGE_SIZE}
    />
  )
}
