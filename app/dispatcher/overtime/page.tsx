import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import DispatcherOvertimeClient from './overtime-client'

export default async function DispatcherOvertimePage() {
  const { user } = await getServerUser()
  if (!user) redirect('/login')

  const supabase = await createSupabaseServerClient()

  const [
    { data: banner },
    { data: shifts },
    { data: bids },
    { data: offDayRequests },
    { data: employees },
  ] = await Promise.all([
    supabase.from('ot_banner').select('*').eq('id', 'singleton').maybeSingle(),
    supabase.from('overtime_shifts').select('*').order('date', { ascending: false }).limit(50),
    supabase.from('overtime_bids').select('overtime_shift_id'),
    supabase.from('off_day_requests').select('*, employees(name)').order('requested_date', { ascending: false }).limit(100),
    supabase.from('employees').select('id, name').eq('is_active', true).order('name'),
  ])

  // Count bids per shift
  const bidMap: Record<string, number> = {}
  ;(bids ?? []).forEach((b: any) => {
    bidMap[b.overtime_shift_id] = (bidMap[b.overtime_shift_id] ?? 0) + 1
  })

  const shiftsWithCount = (shifts ?? []).map((s: any) => ({
    ...s,
    bid_count: bidMap[s.id] ?? 0,
  }))

  return (
    <DispatcherOvertimeClient
      banner={banner as any}
      shifts={shiftsWithCount as any}
      offDayRequests={(offDayRequests ?? []) as any}
      employees={(employees ?? []) as any}
    />
  )
}
