import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import AdminOvertimeClient from './overtime-client'

export default async function AdminOvertimePage() {
  const { user } = await getServerUser()
  if (!user) redirect('/login')

  const supabase = await createSupabaseServerClient()

  const [{ data: shiftsRaw }, { data: offDayRequests }, { data: bannerData }, { data: employees }] = await Promise.all([
    supabase.from('overtime_shifts').select('*').order('date', { ascending: false }),
    supabase.from('off_day_requests').select('*, employees(name)').order('requested_date', { ascending: false }).limit(100),
    supabase.from('ot_banner').select('*').eq('id', 'singleton').single(),
    supabase.from('employees').select('id, name').eq('is_active', true).order('name'),
  ])

  // Count bids and awards per shift
  const shiftIds = (shiftsRaw ?? []).map((s: any) => s.id)
  let bidCounts: Record<string, number> = {}
  let awardCounts: Record<string, number> = {}

  if (shiftIds.length > 0) {
    const [{ data: bids }, { data: awards }] = await Promise.all([
      supabase.from('overtime_bids').select('overtime_shift_id').in('overtime_shift_id', shiftIds),
      supabase.from('overtime_awards').select('overtime_shift_id').in('overtime_shift_id', shiftIds),
    ])
    ;(bids ?? []).forEach((b: any) => { bidCounts[b.overtime_shift_id] = (bidCounts[b.overtime_shift_id] ?? 0) + 1 })
    ;(awards ?? []).forEach((a: any) => { awardCounts[a.overtime_shift_id] = (awardCounts[a.overtime_shift_id] ?? 0) + 1 })
  }

  const shifts = (shiftsRaw ?? []).map((s: any) => ({
    ...s,
    bid_count: bidCounts[s.id] ?? 0,
    award_count: awardCounts[s.id] ?? 0,
  }))

  const defaultBanner = { id: 'singleton', is_active: false, message: 'Today, if you are available to work up to 10 hours, we would greatly appreciate it.', updated_by: null, updated_at: new Date().toISOString() }

  return (
    <AdminOvertimeClient
      shifts={shifts as any}
      offDayRequests={(offDayRequests ?? []) as any}
      banner={(bannerData ?? defaultBanner) as any}
      employees={(employees ?? []) as any}
    />
  )
}
