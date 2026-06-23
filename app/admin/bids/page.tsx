import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import { ShiftBidCycle, BidCycleStatus } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge, type BadgeProps } from '@/components/ui/badge'

const STATUS_VARIANT: Record<BidCycleStatus, BadgeProps['variant']> = {
  draft:     'neutral',
  published: 'info',
  locked:    'warn',
  awarded:   'ok',
}

export default async function AdminBidsPage() {
  const { user } = await getServerUser()
  if (!user) redirect('/login')

  const supabase = await createSupabaseServerClient()
  const { data: cycles } = await supabase
    .from('shift_bid_cycles')
    .select('*')
    .order('start_date', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">Shift Bid Cycles</h1>
        <Button asChild>
          <Link href="/admin/bids/new">
            <Plus className="size-4" /> New Cycle
          </Link>
        </Button>
      </div>

      {(!cycles || cycles.length === 0) ? (
        <Card className="p-8 text-center text-muted-foreground">
          No bid cycles yet. Create one to get started.
        </Card>
      ) : (
        <div className="space-y-3">
          {(cycles as ShiftBidCycle[]).map((cycle) => (
            <Link
              key={cycle.id}
              href={`/admin/bids/${cycle.id}`}
              className="block rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-foreground font-semibold truncate">{cycle.name}</h2>
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
                <Badge variant={STATUS_VARIANT[cycle.status]} className="shrink-0">{cycle.status}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
