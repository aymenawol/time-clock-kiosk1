import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase-server'
import NewBidCycleClient from './new-cycle-client'

export default async function NewBidCyclePage() {
  const { user } = await getServerUser()
  if (!user) redirect('/login')
  return <NewBidCycleClient />
}
