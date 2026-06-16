'use client'

import { useState, useTransition } from 'react'
import { createPayPeriodAction } from './actions'

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
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Payroll Periods</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-500 text-foreground text-sm font-semibold px-4 py-2 rounded-lg"
        >
          + New Period
        </button>
      </div>

      {/* New period form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-foreground font-semibold">Create Pay Period</h2>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-muted-foreground text-xs block mb-1">Period Start</label>
              <input name="period_start" type="date" required
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
            </div>
            <div>
              <label className="text-muted-foreground text-xs block mb-1">Period End</label>
              <input name="period_end" type="date" required
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
            </div>
            <div>
              <label className="text-muted-foreground text-xs block mb-1">Pay Date</label>
              <input name="pay_date" type="date" required
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={isPending}
              className="bg-green-600 hover:bg-green-500 text-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
              {isPending ? 'Creating…' : 'Create Period'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="text-muted-foreground hover:text-foreground text-sm px-4 py-2 rounded-lg">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Period list */}
      <div className="space-y-3">
        {periods.length === 0 && (
          <p className="text-muted-foreground text-center py-12">No pay periods created yet.</p>
        )}
        {periods.map(period => (
          <a
            key={period.id}
            href={`/admin/payroll/${period.id}`}
            className="block bg-card border border-border hover:border-border rounded-xl p-4 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-foreground font-semibold">
                  {new Date(period.period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {' — '}
                  {new Date(period.period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                {period.pay_date && (
                  <p className="text-muted-foreground text-sm">
                    Pay date: {new Date(period.pay_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4">
                {period.exports_count > 0 && (
                  <span className="text-muted-foreground text-xs">{period.exports_count} export(s)</span>
                )}
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                  period.status === 'closed'
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-green-900/40 text-green-400 border border-green-800'
                }`}>
                  {period.status === 'closed' ? 'Closed' : 'Open'}
                </span>
                <span className="text-gray-600">→</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
