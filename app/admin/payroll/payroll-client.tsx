'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Plus, ChevronRight } from 'lucide-react'
import { createPayPeriodAction } from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface PayPeriod {
  id: string
  period_start: string
  period_end: string
  pay_date: string | null
  status: 'open' | 'closed'
  created_at: string
  closed_at: string | null
  exports_count: number
}

interface Props { periods: PayPeriod[] }

export default function PayrollClient({ periods }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const start   = fd.get('period_start') as string
    const end     = fd.get('period_end') as string
    const payDate = fd.get('pay_date') as string
    setError(null)

    startTransition(async () => {
      const res = await createPayPeriodAction(start, end, payDate)
      if (res.error) { setError(res.error); return }
      setShowForm(false)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">Payroll Periods</h1>
        <Button onClick={() => setShowForm(!showForm)} className="self-start sm:self-auto">
          <Plus />
          New Period
        </Button>
      </div>

      {/* New period form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Pay Period</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              {error && <p className="text-danger text-sm">{error}</p>}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="period_start">Period Start</Label>
                  <Input id="period_start" name="period_start" type="date" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="period_end">Period End</Label>
                  <Input id="period_end" name="period_end" type="date" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pay_date">Pay Date</Label>
                  <Input id="pay_date" name="pay_date" type="date" required />
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" variant="success" disabled={isPending}>
                  {isPending ? 'Creating…' : 'Create Period'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Period list */}
      <div className="space-y-3">
        {periods.length === 0 && (
          <p className="text-muted-foreground text-center py-12">No pay periods created yet.</p>
        )}
        {periods.map(period => (
          <Link
            key={period.id}
            href={`/admin/payroll/${period.id}`}
            className="block rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-foreground font-semibold truncate">
                  {new Date(period.period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {' — '}
                  {new Date(period.period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                {period.pay_date && (
                  <p className="text-muted-foreground text-sm truncate">
                    Pay date: {new Date(period.pay_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {period.exports_count > 0 && (
                  <span className="hidden text-muted-foreground text-xs sm:inline">{period.exports_count} export(s)</span>
                )}
                <Badge variant={period.status === 'closed' ? 'neutral' : 'ok'}>
                  {period.status === 'closed' ? 'Closed' : 'Open'}
                </Badge>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
