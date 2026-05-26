import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import DriverBidsClient from './bids-client'

export default async function DriverBidsPage() {
  const { user } = await getServerUser()
  if (!user) redirect('/')

  const supabase = await createSupabaseServerClient()

  // Get employee record
  const { data: emp } = await supabase
    .from('employees')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  // Get active cycle (published or locked or awarded)
  const { data: cycle } = await supabase
    .from('shift_bid_cycles')
    .select('*')
    .in('status', ['published', 'locked', 'awarded'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!cycle) {
    return <DriverBidsClient activeCycle={null} slots={[]} mySubmission={null} myAward={null} />
  }

  const [{ data: slots }, { data: mySubmission }, { data: myAward }] = await Promise.all([
    supabase.from('shift_bid_slots').select('*').eq('cycle_id', cycle.id).order('bid_number'),
    emp ? supabase.from('shift_bid_submissions').select('*').eq('cycle_id', cycle.id).eq('employee_id', emp.id).maybeSingle() : Promise.resolve({ data: null }),
    emp ? supabase.from('shift_bid_awards').select('*, shift_bid_slots(*)').eq('cycle_id', cycle.id).eq('employee_id', emp.id).maybeSingle() : Promise.resolve({ data: null }),
  ])

  return (
    <DriverBidsClient
      activeCycle={cycle as any}
      slots={(slots ?? []) as any}
      mySubmission={mySubmission as any}
      myAward={myAward as any}
    />
  )
}
