'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <button
          onClick={() => window.print()}
          className="px-3 py-1.5 bg-muted hover:bg-gray-700 text-foreground text-sm border border-border rounded"
        >
          Print / PDF
        </button>
      </div>

      <div className="flex border-b border-border mb-6 gap-1 overflow-x-auto">
        {REPORT_TABS.map((t) => (
          <button
            key={t}
            onClick={() => goToTab(t)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t ? 'border-b-2 border-blue-500 text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {REPORT_CONFIG[t].label}
          </button>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-foreground font-semibold">{config.label}</h2>
          <button
            onClick={handleExport}
            disabled={isPending}
            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-foreground text-xs rounded disabled:opacity-50"
          >
            {isPending ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded bg-red-950 border border-red-800 px-3 py-2 text-red-300 text-xs">
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
                    <th key={c} className="text-left py-2 pr-4 capitalize">
                      {c.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-card/30">
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
        <div className="flex items-center justify-between text-sm mt-4">
          <p className="text-muted-foreground">
            {totalCount === 0 ? 'No results' : `Showing ${rangeStart}–${rangeEnd} of ${totalCount}`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
                className="bg-muted hover:bg-gray-700 text-foreground px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <span className="text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => goToPage(page + 1)}
                className="bg-muted hover:bg-gray-700 text-foreground px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
