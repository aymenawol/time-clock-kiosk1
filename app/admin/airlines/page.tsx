import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import AirlinesClient from './airlines-client'

export const metadata = { title: 'Airline Management' }

export default async function AirlinesPage() {
  const { user } = await getServerUser()
  if (!user) redirect('/')
  if ((user.app_metadata?.role as string) !== 'admin') redirect('/unauthorized')

  const supabase = await createSupabaseServerClient()
  const { data: airlines } = await supabase
    .from('airlines')
    .select('id, name, terminal, phone, wheelchair_contact, notes, is_active')
    .order('name')

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Airline Management</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure airlines for 10-51 wheelchair request form</p>
      </div>
      <AirlinesClient airlines={airlines ?? []} />
    </div>
  )
}
