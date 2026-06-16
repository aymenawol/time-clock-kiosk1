import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import { ShiftBidCycle, BID_CYCLE_STATUS_COLOR } from '@/lib/supabase'

export default async function AdminBidsPage() {
  const { user } = await getServerUser()
  if (!user) redirect('/login')

  const supabase = await createSupabaseServerClient()
  const { data: cycles } = await supabase
    .from('shift_bid_cycles')
    .select('*')
    .order('start_date', { ascending: false })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Shift Bid Cycles</h1>
        <Link
          href="/admin/bids/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-foreground text-sm font-medium rounded-md transition-colors"
        >
          + New Cycle
        </Link>
      </div>

      {(!cycles || cycles.length === 0) ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          No bid cycles yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {(cycles as ShiftBidCycle[]).map((cycle) => (
            <Link
              key={cycle.id}
              href={`/admin/bids/${cycle.id}`}
              className="block rounded-lg border border-border bg-card p-4 hover:border-border transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-foreground font-semibold">{cycle.name}</h2>
                  {cycle.description && (
                    <p className="text-muted-foreground text-sm mt-0.5">{cycle.description}</p>
                  )}
                  <p className="text-muted-foreground text-xs mt-1">
                    {cycle.start_date} — {cycle.end_date}
                    {cycle.submission_open_at && (
                      <> · Submissions {cycle.submission_open_at.slice(0, 10)} to {cycle.submission_close_at?.slice(0, 10)}</>
                    )}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${BID_CYCLE_STATUS_COLOR[cycle.status]}`}>
                  {cycle.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
