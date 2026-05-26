import { createSupabaseServerClient } from '@/lib/supabase-server'
import PayrollClient from './payroll-client'

export default async function PayrollPage() {
  const supabase = await createSupabaseServerClient()

  const { data: periods } = await supabase
    .from('pay_periods')
    .select('id, period_start, period_end, pay_date, status, created_at, closed_at')
    .order('period_start', { ascending: false })

  // Count exports per period
  const { data: exports } = await supabase
    .from('payroll_exports')
    .select('pay_period_id')

  const exportCount: Record<string, number> = {}
  for (const ex of (exports ?? [])) {
    exportCount[ex.pay_period_id] = (exportCount[ex.pay_period_id] ?? 0) + 1
  }

  const enriched = (periods ?? []).map(p => ({
    ...p,
    exports_count: exportCount[p.id] ?? 0,
  }))

  return <PayrollClient periods={enriched as Parameters<typeof PayrollClient>[0]['periods']} />
}
