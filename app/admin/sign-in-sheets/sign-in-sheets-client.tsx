'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Employee { id: string; name: string; seniority_number: number | null; employee_id: string }
interface Shift {
  id: string; date: string; status: string; scheduled_start: string | null; scheduled_end: string | null
  actual_start: string | null; actual_end: string | null; radio_status: string | null
  employee: Employee | null
  bus: { bus_number: string; bus_type: string } | null
  tablet: { tablet_number: string } | null
}

interface Props {
  shifts: Shift[]
  totalCount: number
  dateFilter: string
  page: number
  pageSize: number
}

const STATUS_COLOR: Record<string, string> = {
  active:    'bg-blue-900 text-blue-300',
  completed: 'bg-green-900 text-green-300',
  scheduled: 'bg-gray-700 text-gray-400',
  cancelled: 'bg-red-900 text-red-400',
}

export default function SignInSheetsClient({ shifts, totalCount, dateFilter, page, pageSize }: Props) {
  const router = useRouter()
  const [date, setDate] = useState(dateFilter)

  const totalPages = Math.ceil(totalCount / pageSize)

  function handleDateChange(d: string) {
    setDate(d)
    router.push(`/admin/sign-in-sheets?date=${d}&page=1`)
  }

  function exportCSV() {
    const header = ['Seniority#', 'Employee ID', 'Name', 'Scheduled Start', 'Scheduled End', 'Actual Start', 'Actual End', 'Status', 'Bus', 'Bus Type', 'Tablet', 'Radio Code']
    const rows = shifts.map(s => [
      s.employee?.seniority_number ?? '',
      s.employee?.employee_id ?? '',
      s.employee ? s.employee.name : '',
      s.scheduled_start ?? '',
      s.scheduled_end ?? '',
      s.actual_start ? new Date(s.actual_start).toLocaleTimeString() : '',
      s.actual_end ? new Date(s.actual_end).toLocaleTimeString() : '',
      s.status,
      s.bus?.bus_number ?? '',
      s.bus?.bus_type ?? '',
      s.tablet?.tablet_number ?? '',
      s.radio_status ?? '',
    ])
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sign-in-sheet-${dateFilter}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Sign-In Sheets</h1>
          <p className="text-gray-500 text-sm">{totalCount} shift{totalCount !== 1 ? 's' : ''} · {dateFilter}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={e => handleDateChange(e.target.value)}
            className="bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm"
          />
          <button
            onClick={exportCSV}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-3 py-1.5 rounded-lg border border-gray-700"
          >
            ↓ Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-3 py-1.5 rounded-lg border border-gray-700"
          >
            🖨 Print
          </button>
        </div>
      </div>

      {/* Table */}
      {shifts.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <p className="text-gray-500">No shifts found for {dateFilter}.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Sen#</th>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Scheduled</th>
                  <th className="text-left px-4 py-3">Actual In</th>
                  <th className="text-left px-4 py-3">Actual Out</th>
                  <th className="text-left px-4 py-3">Bus</th>
                  <th className="text-left px-4 py-3">Tablet</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Radio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {shifts.map(s => (
                  <tr key={s.id} className="hover:bg-gray-800/40">
                    <td className="px-4 py-3 text-gray-500 text-xs">{s.employee?.seniority_number ?? '—'}</td>
                    <td className="px-4 py-3 text-white font-medium">
                      {s.employee ? s.employee.name : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 tabular-nums">
                      {s.scheduled_start ?? '—'} – {s.scheduled_end ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 tabular-nums">
                      {s.actual_start ? new Date(s.actual_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 tabular-nums">
                      {s.actual_end ? new Date(s.actual_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {s.bus ? `#${s.bus.bus_number} ${s.bus.bus_type}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {s.tablet?.tablet_number ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLOR[s.status] ?? 'bg-gray-800 text-gray-500'}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {s.radio_status ? (
                        <span className="text-xs text-gray-400">{s.radio_status}</span>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <button
                onClick={() => router.push(`/admin/sign-in-sheets?date=${dateFilter}&page=${page - 1}`)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg"
              >
                ← Prev
              </button>
            )}
            {page < totalPages && (
              <button
                onClick={() => router.push(`/admin/sign-in-sheets?date=${dateFilter}&page=${page + 1}`)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg"
              >
                Next →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
