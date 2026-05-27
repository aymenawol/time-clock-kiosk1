'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
  driver: { id: string; first_name: string; last_name: string; seniority_number: number | null } | null
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Counting Sheets</h1>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => handleDateChange(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm"
        />
      </div>

      {sheets.length === 0 && (
        <p className="text-gray-500 text-sm">No counting sheets for this date.</p>
      )}

      {sheets.map((sheet) => {
        const totals = rowTotals(sheet.counting_rows)
        const grand = totals.rac + totals.t1 + totals.t3 + totals.term1 + totals.term3_west + totals.term3_east
        const isExpanded = expanded === sheet.id

        return (
          <div key={sheet.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <button
              className="w-full text-left p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
              onClick={() => setExpanded(isExpanded ? null : sheet.id)}
            >
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-white font-semibold">
                    {sheet.driver ? `${sheet.driver.first_name} ${sheet.driver.last_name}` : 'Unknown'}
                    {sheet.driver?.seniority_number ? (
                      <span className="text-gray-500 text-xs ml-2">#{sheet.driver.seniority_number}</span>
                    ) : null}
                  </p>
                  <p className="text-gray-400 text-sm">Bus {sheet.bus?.bus_number ?? '—'} · {sheet.bus?.bus_type ?? ''}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-xs">Total Riders</p>
                  <p className="text-white font-bold text-lg">{grand}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  sheet.status === 'submitted' ? 'bg-green-900 text-green-300' :
                  sheet.status === 'in_progress' ? 'bg-yellow-900 text-yellow-300' :
                  'bg-gray-800 text-gray-400'
                }`}>
                  {sheet.status.replace('_', ' ')}
                </span>
                {sheet.submitted_at && (
                  <p className="text-gray-500 text-xs">
                    {new Date(sheet.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                <span className="text-gray-500 text-lg">{isExpanded ? '▲' : '▼'}</span>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-gray-800 p-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs uppercase">
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
                        <tr key={row.id ?? i} className="border-t border-gray-800/50 text-gray-300">
                          <td className="py-1.5 pr-4 font-mono">{row.departure_time || '—'}</td>
                          <td className="text-right pr-3">{row.rac}</td>
                          <td className="text-right pr-3">{row.t1}</td>
                          <td className="text-right pr-3">{row.t3}</td>
                          <td className="text-right pr-3">{row.term1}</td>
                          <td className="text-right pr-3">{row.term3_west}</td>
                          <td className="text-right">{row.term3_east}</td>
                        </tr>
                      ))}
                    <tr className="border-t-2 border-gray-700 text-white font-semibold">
                      <td className="py-2 pr-4 text-xs uppercase text-gray-400">Totals</td>
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
          </div>
        )
      })}
    </div>
  )
}
