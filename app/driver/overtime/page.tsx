import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import DriverOvertimeClient from './overtime-client'

export default async function DriverOvertimePage() {
  const { user } = await getServerUser()
  if (!user) redirect('/')

  const supabase = await createSupabaseServerClient()

  const { data: emp } = await supabase
    .from('employees')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  const employeeId = emp?.id ?? null

  const [
    { data: banner },
    { data: openShifts },
    { data: myBids },
    { data: myAwards },
    { data: offDayRequests },
  ] = await Promise.all([
    supabase.from('ot_banner').select('*').eq('id', 'singleton').maybeSingle(),
    supabase.from('overtime_shifts').select('*').eq('status', 'open').order('date'),
    employeeId
      ? supabase.from('overtime_bids').select('overtime_shift_id').eq('employee_id', employeeId)
      : Promise.resolve({ data: [] }),
    employeeId
      ? supabase.from('overtime_awards').select('overtime_shift_id').eq('employee_id', employeeId)
      : Promise.resolve({ data: [] }),
    employeeId
      ? supabase.from('off_day_requests').select('*').eq('employee_id', employeeId).order('requested_date', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const myBidShiftIds = new Set((myBids ?? []).map((b: any) => b.overtime_shift_id))
  const myAwardShiftIds = new Set((myAwards ?? []).map((a: any) => a.overtime_shift_id))

  const shiftsWithBidFlag = (openShifts ?? []).map((s: any) => ({
    ...s,
    my_bid: myBidShiftIds.has(s.id),
  }))

  // For awarded shifts, we already filtered only awarded from shifts (would need separate query)
  // Here we pass openShifts that the driver has been awarded
  const awardedShifts = (openShifts ?? []).filter((s: any) => myAwardShiftIds.has(s.id))

  return (
    <DriverOvertimeClient
      banner={banner as any}
      openShifts={shiftsWithBidFlag as any}
      myBidShifts={[]}
      myAwardedShifts={awardedShifts as any}
      offDayRequests={(offDayRequests ?? []) as any}
    />
  )
}
