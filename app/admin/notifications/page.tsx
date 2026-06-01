import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import NotificationsClient from './notifications-client'

export const metadata = { title: 'Notification Log' }

export default async function NotificationsPage() {
  const { user } = await getServerUser()
  if (!user) redirect('/')
  if ((user.app_metadata?.role as string) !== 'admin') redirect('/unauthorized')

  const supabase = await createSupabaseServerClient()

  const { data: raw } = await supabase
    .from('notification_log')
    .select(`
      id, event_type, channel, sent_at, delivered_at, failed, failure_reason,
      employees!recipient_id(name)
    `)
    .order('sent_at', { ascending: false })
    .limit(1000)

  type RawLog = {
    id: string
    event_type: string
    channel: string
    sent_at: string
    delivered_at: string | null
    failed: boolean
    failure_reason: string | null
    employees: { name: string } | null
  }

  const logs = ((raw ?? []) as unknown as RawLog[]).map((l) => ({
    id:             l.id,
    recipient_name: l.employees?.name ?? 'Unknown',
    event_type:     l.event_type,
    channel:        l.channel,
    sent_at:        l.sent_at,
    delivered_at:   l.delivered_at,
    failed:         l.failed,
    failure_reason: l.failure_reason,
  }))

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Notification Log</h1>
        <p className="text-gray-400 text-sm mt-1">SMS, push, and in-app delivery records</p>
      </div>
      <NotificationsClient logs={logs} />
    </div>
  )
}
