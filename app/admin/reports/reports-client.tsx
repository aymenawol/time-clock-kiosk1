'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Printer, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { REPORT_CONFIG, REPORT_TABS, type ReportTab } from './report-data'
import { exportReportCSVAction } from './actions'

interface Props {
  tab: ReportTab
  rows: Record<string, any>[]
  totalCount: number
  page: number
  pageSize: number
}

export default function AdminReportsClient({ tab, rows, totalCount, page, pageSize }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const config = REPORT_CONFIG[tab]
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, totalCount)

  function goToTab(next: ReportTab) {
    router.push(`/admin/reports?tab=${next}&page=1`)
  }

  function goToPage(next: number) {
    router.push(`/admin/reports?tab=${tab}&page=${next}`)
  }

  function handleExport() {
    setError(null)
    startTransition(async () => {
      const result = await exportReportCSVAction(tab)
      if (!result.success) {
        setError(result.error)
        return
      }
      const blob = new Blob([result.data.csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.data.filename
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Printer className="size-4" /> Print / PDF
        </Button>
      </div>

      <div className="flex border-b border-border mb-6 gap-1 overflow-x-auto">
        {REPORT_TABS.map((t) => (
          <button
            key={t}
            onClick={() => goToTab(t)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {REPORT_CONFIG[t].label}
          </button>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h2 className="text-foreground font-semibold">{config.label}</h2>
          <Button size="sm" onClick={handleExport} disabled={isPending}>
            {isPending ? 'Exporting…' : 'Export CSV'}
          </Button>
        </div>

        {error && (
          <p className="mb-3 rounded-lg bg-danger-surface border border-danger-border px-3 py-2 text-danger text-xs">
            {error}
          </p>
        )}

        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No data.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs">
                  {config.cols.map((c) => (
                    <th key={c} className="text-left py-2 pr-4 capitalize whitespace-nowrap">
                      {c.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-accent">
                    {config.cols.map((c) => (
                      <td key={c} className="py-2 pr-4 text-foreground">
                        {String(row[c] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between gap-2 text-sm mt-4 flex-wrap">
          <p className="text-muted-foreground">
            {totalCount === 0 ? 'No results' : `Showing ${rangeStart}–${rangeEnd} of ${totalCount}`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                <ChevronLeft className="size-4" /> Prev
              </Button>
              <span className="text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
                Next <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
