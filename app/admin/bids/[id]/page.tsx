import { redirect, notFound } from 'next/navigation'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import BidCycleClient from './bid-cycle-client'

interface Props { params: Promise<{ id: string }> }

export default async function BidCyclePage({ params }: Props) {
  const { id } = await params
  const { user } = await getServerUser()
  if (!user) redirect('/login')

  const supabase = await createSupabaseServerClient()

  const [{ data: cycle }, { data: slotsRaw }, { data: submissions }, { data: awards }] = await Promise.all([
    supabase.from('shift_bid_cycles').select('*').eq('id', id).single(),
    supabase.from('shift_bid_slots').select('*').eq('cycle_id', id).order('bid_number'),
    supabase.from('shift_bid_submissions').select('*, employees(name, seniority_number)').eq('cycle_id', id),
    supabase.from('shift_bid_awards').select('*, employees(name), shift_bid_slots(bid_number)').eq('cycle_id', id),
  ])

  if (!cycle) notFound()

  // Attach award counts to slots
  const slots = (slotsRaw ?? []).map(slot => ({
    ...slot,
    awards: (awards ?? []).filter((a: any) => a.slot_id === slot.id),
  }))

  return (
    <BidCycleClient
      cycle={cycle}
      slots={slots as any}
      submissions={(submissions ?? []) as any}
      awards={(awards ?? []) as any}
    />
  )
}
