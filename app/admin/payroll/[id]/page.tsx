import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import PayrollPeriodClient from './payroll-period-client'

export default async function PayrollPeriodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const { data: period } = await supabase
    .from('pay_periods')
    .select('id, period_start, period_end, pay_date, status')
    .eq('id', id)
    .single()

  if (!period) notFound()

  const { data: records } = await supabase
    .from('daily_hours_records')
    .select('id, employee_id, work_date, regular_hours, overtime_hours, pto_hours, fmla_hours, total_paid_hours, missed_breaks, is_incomplete, clock_in, clock_out, employees(name)')
    .eq('pay_period_id', id)
    .order('work_date')

  const enriched = (records ?? []).map((r: Record<string, unknown>) => {
    const emp = r.employees as Record<string, unknown> | null
    return {
      id:              r.id as string,
      employee_id:     r.employee_id as string,
      employee_name:   emp ? (emp.name as string) : 'Unknown',
      work_date:       r.work_date as string,
      regular_hours:   r.regular_hours as number,
      overtime_hours:  r.overtime_hours as number,
      pto_hours:       r.pto_hours as number,
      fmla_hours:      r.fmla_hours as number,
      total_paid_hours: r.total_paid_hours as number,
      missed_breaks:   r.missed_breaks as number,
      is_incomplete:   r.is_incomplete as boolean,
      clock_in:        r.clock_in as string | null,
      clock_out:       r.clock_out as string | null,
    }
  })

  return (
    <PayrollPeriodClient
      period={period as Parameters<typeof PayrollPeriodClient>[0]['period']}
      records={enriched}
    />
  )
}
