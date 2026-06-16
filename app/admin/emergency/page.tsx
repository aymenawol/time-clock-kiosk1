import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import EmergencyClient from './emergency-client'

export const metadata = { title: 'Emergency Operations' }

export default async function EmergencyPage() {
  const { user } = await getServerUser()
  if (!user) redirect('/')

  const role = (user.app_metadata?.role as string) ?? ''
  if (role !== 'admin') redirect('/unauthorized')

  const supabase = await createSupabaseServerClient()

  // Load currently active emergency event (if any)
  const { data: activeEvent } = await supabase
    .from('emergency_events')
    .select('id, event_type, message, triggered_at')
    .eq('is_active', true)
    .maybeSingle()

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Emergency Operations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Trigger a fleet-wide emergency alert. All employees see a full-screen modal until they acknowledge.
        </p>
      </div>
      <EmergencyClient initialActiveEvent={activeEvent} />
    </div>
  )
}
