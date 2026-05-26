'use client'
import { useState, useTransition } from 'react'

type ReportTab = 'hours' | 'overtime' | 'forms' | 'safety' | 'bids'

interface EmployeeHoursRow { name: string; date: string; clock_in: string; clock_out: string | null; total_hours: number | null }
interface OtAwardRow { employee_name: string; date: string; duration_hours: number; award_method: string }
interface FormRow { employee_name: string; form_type: string; status: string; submitted_at: string }
interface SafetyRow { title: string; department: string; scheduled_date: string; signin_count: number }
interface BidAwardRow { employee_name: string; slot_bid_number: number; preference_rank: number | null; award_method: string; cycle_name: string }

interface Props {
  hoursData: EmployeeHoursRow[]
  otAwards: OtAwardRow[]
  forms: FormRow[]
  safetyMeetings: SafetyRow[]
  bidAwards: BidAwardRow[]
}

function downloadCsv(filename: string, rows: Record<string, any>[]) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function AdminReportsClient({ hoursData, otAwards, forms, safetyMeetings, bidAwards }: Props) {
  const [tab, setTab] = useState<ReportTab>('hours')

  const tabs: { id: ReportTab; label: string }[] = [
    { id: 'hours', label: 'Employee Hours' },
    { id: 'overtime', label: 'Overtime Awards' },
    { id: 'forms', label: 'Form Submissions' },
    { id: 'safety', label: 'Safety Meetings' },
    { id: 'bids', label: 'Bid Awards' },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <button onClick={() => window.print()}
          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-sm border border-gray-700 rounded">
          Print / PDF
        </button>
      </div>

      <div className="flex border-b border-gray-800 mb-6 gap-1 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.id ? 'border-b-2 border-blue-500 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}>{t.label}</button>
        ))}
      </div>

      {tab === 'hours' && (
        <ReportTable
          title="Employee Hours"
          rows={hoursData}
          cols={['name','date','clock_in','clock_out','total_hours']}
          onExport={() => downloadCsv('employee-hours.csv', hoursData)}
        />
      )}
      {tab === 'overtime' && (
        <ReportTable
          title="Overtime Awards"
          rows={otAwards}
          cols={['employee_name','date','duration_hours','award_method']}
          onExport={() => downloadCsv('overtime-awards.csv', otAwards)}
        />
      )}
      {tab === 'forms' && (
        <ReportTable
          title="Form Submissions"
          rows={forms}
          cols={['employee_name','form_type','status','submitted_at']}
          onExport={() => downloadCsv('form-submissions.csv', forms)}
        />
      )}
      {tab === 'safety' && (
        <ReportTable
          title="Safety Meetings"
          rows={safetyMeetings}
          cols={['title','department','scheduled_date','signin_count']}
          onExport={() => downloadCsv('safety-meetings.csv', safetyMeetings)}
        />
      )}
      {tab === 'bids' && (
        <ReportTable
          title="Bid Awards"
          rows={bidAwards}
          cols={['cycle_name','employee_name','slot_bid_number','preference_rank','award_method']}
          onExport={() => downloadCsv('bid-awards.csv', bidAwards)}
        />
      )}
    </div>
  )
}

function ReportTable({
  title, rows, cols, onExport,
}: {
  title: string
  rows: Record<string, any>[]
  cols: string[]
  onExport: () => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white font-semibold">{title}</h2>
        <button onClick={onExport}
          className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded">
          Export CSV
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm">No data.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs">
                {cols.map(c => (
                  <th key={c} className="text-left py-2 pr-4 capitalize">{c.replace(/_/g, ' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                  {cols.map(c => (
                    <td key={c} className="py-2 pr-4 text-gray-300">
                      {String(row[c] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
