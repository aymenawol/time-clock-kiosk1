'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

interface CountingRow {
  id?: string
  row_order: number
  departure_time: string
  rac: number; t1: number; t3: number
  term1: number; term3_west: number; term3_east: number
}

interface Sheet {
  id: string
  date: string
  status: string
  submitted_at: string | null
  start_time: string | null
  end_time: string | null
  driver: { id: string; name: string; seniority_number: number | null } | null
  bus: { bus_number: string; bus_type: string } | null
  counting_rows: CountingRow[]
}

export default function CountingSheetsReviewClient({
  sheets,
  dateFilter,
}: {
  sheets: Sheet[]
  dateFilter: string
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<string | null>(null)

  function handleDateChange(d: string) {
    router.push(`/admin/counting-sheets?date=${d}`)
  }

  function rowTotals(rows: CountingRow[]) {
    return rows.reduce(
      (acc, r) => ({
        rac: acc.rac + (r.rac || 0),
        t1: acc.t1 + (r.t1 || 0),
        t3: acc.t3 + (r.t3 || 0),
        term1: acc.term1 + (r.term1 || 0),
        term3_west: acc.term3_west + (r.term3_west || 0),
        term3_east: acc.term3_east + (r.term3_east || 0),
      }),
      { rac: 0, t1: 0, t3: 0, term1: 0, term3_west: 0, term3_east: 0 }
    )
  }

  const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
    submitted: 'ok',
    in_progress: 'warn',
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-foreground">Counting Sheets</h1>
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => handleDateChange(e.target.value)}
          className="h-9 w-auto text-sm"
        />
      </div>

      {sheets.length === 0 && (
        <p className="text-muted-foreground text-sm">No counting sheets for this date.</p>
      )}

      {sheets.map((sheet) => {
        const totals = rowTotals(sheet.counting_rows)
        const grand = totals.rac + totals.t1 + totals.t3 + totals.term1 + totals.term3_west + totals.term3_east
        const isExpanded = expanded === sheet.id

        return (
          <Card key={sheet.id} className="overflow-hidden p-0">
            <button
              className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-muted/50 transition-colors"
              onClick={() => setExpanded(isExpanded ? null : sheet.id)}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="min-w-0">
                  <p className="text-foreground font-semibold truncate">
                    {sheet.driver ? sheet.driver.name : 'Unknown'}
                    {sheet.driver?.seniority_number ? (
                      <span className="text-muted-foreground text-xs ml-2">#{sheet.driver.seniority_number}</span>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground text-sm">Bus {sheet.bus?.bus_number ?? '—'} · {sheet.bus?.bus_type ?? ''}</p>
                </div>
                <div className="text-center shrink-0">
                  <p className="text-muted-foreground text-xs">Total Riders</p>
                  <p className="text-foreground font-bold text-lg">{grand}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Badge variant={STATUS_VARIANT[sheet.status] ?? 'neutral'}>
                  {sheet.status.replace('_', ' ')}
                </Badge>
                {sheet.submitted_at && (
                  <p className="text-muted-foreground text-xs">
                    {new Date(sheet.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                {isExpanded
                  ? <ChevronUp className="size-4 text-muted-foreground" />
                  : <ChevronDown className="size-4 text-muted-foreground" />}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-border p-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground text-xs uppercase">
                      <th className="text-left py-1.5 pr-4">Departure</th>
                      <th className="text-right py-1.5 pr-3">RAC</th>
                      <th className="text-right py-1.5 pr-3">T1</th>
                      <th className="text-right py-1.5 pr-3">T3</th>
                      <th className="text-right py-1.5 pr-3">Term 1</th>
                      <th className="text-right py-1.5 pr-3">Term 3W</th>
                      <th className="text-right py-1.5">Term 3E</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.counting_rows
                      .sort((a, b) => a.row_order - b.row_order)
                      .map((row, i) => (
                        <tr key={row.id ?? i} className="border-t border-border/50 text-foreground">
                          <td className="py-1.5 pr-4 font-mono">{row.departure_time || '—'}</td>
                          <td className="text-right pr-3">{row.rac}</td>
                          <td className="text-right pr-3">{row.t1}</td>
                          <td className="text-right pr-3">{row.t3}</td>
                          <td className="text-right pr-3">{row.term1}</td>
                          <td className="text-right pr-3">{row.term3_west}</td>
                          <td className="text-right">{row.term3_east}</td>
                        </tr>
                      ))}
                    <tr className="border-t-2 border-border text-foreground font-semibold">
                      <td className="py-2 pr-4 text-xs uppercase text-muted-foreground">Totals</td>
                      <td className="text-right pr-3">{totals.rac}</td>
                      <td className="text-right pr-3">{totals.t1}</td>
                      <td className="text-right pr-3">{totals.t3}</td>
                      <td className="text-right pr-3">{totals.term1}</td>
                      <td className="text-right pr-3">{totals.term3_west}</td>
                      <td className="text-right">{totals.term3_east}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
