import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import LostFoundClient from './lost-found-client'

export const metadata = { title: 'Lost & Found Management' }

export default async function AdminLostFoundPage() {
  const { user } = await getServerUser()
  if (!user) redirect('/')

  const role = (user.app_metadata?.role as string) ?? ''
  if (!['admin', 'management', 'dispatcher', 'supervisor', 'coordinator'].includes(role)) redirect('/unauthorized')

  const supabase = await createSupabaseServerClient()

  const { data: raw } = await supabase
    .from('lost_items')
    .select(`
      id, item_description, location_found, is_bag, bag_contents,
      status, found_at, collected_at, returned_to_dispatch_at,
      claimed_at, claimant_name, disposed_at, disposal_reason, photo_paths,
      buses(bus_number),
      employees!reported_by(name)
    `)
    .order('found_at', { ascending: false })
    .limit(200)

  type RawItem = {
    id: string
    item_description: string
    location_found: string
    is_bag: boolean
    bag_contents: string | null
    status: string
    found_at: string
    collected_at: string | null
    returned_to_dispatch_at: string | null
    claimed_at: string | null
    claimant_name: string | null
    disposed_at: string | null
    disposal_reason: string | null
    photo_paths: string[]
    buses: { bus_number: string } | null
    employees: { name: string } | null
  }

  const items = ((raw ?? []) as unknown as RawItem[]).map((r) => ({
    id:                      r.id,
    item_description:        r.item_description,
    location_found:          r.location_found,
    is_bag:                  r.is_bag,
    bag_contents:            r.bag_contents,
    status:                  r.status as 'found' | 'collected' | 'returned_to_dispatch' | 'claimed' | 'disposed',
    found_at:                r.found_at,
    collected_at:            r.collected_at,
    returned_to_dispatch_at: r.returned_to_dispatch_at,
    claimed_at:              r.claimed_at,
    claimant_name:           r.claimant_name,
    disposed_at:             r.disposed_at,
    disposal_reason:         r.disposal_reason,
    photo_paths:             r.photo_paths ?? [],
    bus_number:              r.buses?.bus_number ?? 'N/A',
    reporter_name:           r.employees?.name ?? 'Unknown',
  }))

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Lost & Found</h1>
          <p className="text-gray-400 text-sm mt-1">Manage found items — {items.length} total</p>
        </div>
      </div>
      <LostFoundClient items={items} />
    </div>
  )
}
