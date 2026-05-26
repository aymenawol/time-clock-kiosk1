'use client'

import { useState, useTransition } from 'react'
import { calculatePayPeriodHoursAction, closePayPeriodAction, correctDailyHoursAction, logPayrollExportAction } from '../actions'
import { buildPayrollCSV } from '@/lib/payroll-calc'

interface DailyRecord {
  id: string
  employee_id: string
  employee_name: string
  work_date: string
  regular_hours: number
  overtime_hours: number
  pto_hours: number
  fmla_hours: number
  total_paid_hours: number
  missed_breaks: number
  is_incomplete: boolean
  clock_in: string | null
  clock_out: string | null
}

interface PayPeriod {
  id: string
  period_start: string
  period_end: string
  pay_date: string | null
  status: 'open' | 'closed'
}

interface Props {
  period: PayPeriod
  records: DailyRecord[]
}

export default function PayrollPeriodClient({ period, records }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const incompleteCount = records.filter(r => r.is_incomplete).length
  const totalRegular    = records.reduce((s, r) => s + r.regular_hours, 0)
  const totalOT         = records.reduce((s, r) => s + r.overtime_hours, 0)

  function handleRecalculate() {
    setError(null); setSuccess(null)
    startTransition(async () => {
      const res = await calculatePayPeriodHoursAction(period.id)
      if (res.error) { setError(res.error); return }
      setSuccess(`Calculated ${res.count} daily records.`)
    })
  }

  function handleClose() {
    if (!confirm('Close this pay period? This cannot be undone.')) return
    setError(null)
    startTransition(async () => {
      const res = await closePayPeriodAction(period.id)
      if (res.error) { setError(res.error); return }
      setSuccess('Pay period closed.')
    })
  }

  function handleExport() {
    const rows = records.map(r => ({
      employee_name:   r.employee_name,
      employee_id:     r.employee_id,
      period_start:    period.period_start,
      period_end:      period.period_end,
      work_date:       r.work_date,
      regular_hours:   r.regular_hours,
      overtime_hours:  r.overtime_hours,
      pto_hours:       r.pto_hours,
      fmla_hours:      r.fmla_hours,
      total_paid_hours: r.total_paid_hours,
      missed_breaks:   r.missed_breaks,
      is_incomplete:   r.is_incomplete,
    }))

    const csv  = buildPayrollCSV(rows)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `payroll_${period.period_start}_${period.period_end}.csv`
    a.click()
    URL.revokeObjectURL(url)

    startTransition(() => logPayrollExportAction(period.id, rows.length))
  }

  function CorrectionModal({ record }: { record: DailyRecord }) {
    const [reason, setReason] = useState('')
    const [reg, setReg] = useState(String(record.regular_hours))
    const [ot, setOt]   = useState(String(record.overtime_hours))
    const [pto, setPto] = useState(String(record.pto_hours))

    function handleSave() {
      if (!reason.trim()) { alert('A reason is required for corrections.'); return }
      startTransition(async () => {
        const res = await correctDailyHoursAction(record.id, {
          regular_hours:  parseFloat(reg),
          overtime_hours: parseFloat(ot),
          pto_hours:      parseFloat(pto),
        }, reason)
        if (res.error) { setError(res.error); return }
        setEditingId(null)
        setSuccess('Correction saved.')
      })
    }

    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditingId(null)}>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
          <h3 className="text-white font-semibold mb-1">Correct Hours — {record.employee_name}</h3>
          <p className="text-gray-400 text-sm mb-4">{record.work_date}</p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[['Regular', reg, setReg], ['OT', ot, setOt], ['PTO', pto, setPto]].map(([label, val, setter]) => (
              <div key={label as string}>
                <label className="text-gray-400 text-xs block mb-1">{label as string} hrs</label>
                <input type="number" step="0.25" min="0" value={val as string}
                  onChange={e => (setter as (v: string) => void)(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" />
              </div>
            ))}
          </div>
          <div className="mb-4">
            <label className="text-gray-400 text-xs block mb-1">Reason (required)</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm resize-none" />
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={isPending}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
              Save Correction
            </button>
            <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-white text-sm px-4 py-2">Cancel</button>
          </div>
        </div>
      </div>
    )
  }

  // Group records by employee
  const byEmployee: Record<string, DailyRecord[]> = {}
  for (const r of records) {
    byEmployee[r.employee_name] = [...(byEmployee[r.employee_name] ?? []), r]
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
      {editingId && (() => {
        const rec = records.find(r => r.id === editingId)
        return rec ? <CorrectionModal record={rec} /> : null
      })()}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <a href="/admin/payroll" className="text-gray-500 text-sm hover:text-white">← Payroll</a>
          <h1 className="text-2xl font-bold text-white mt-1">
            {new Date(period.period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' — '}
            {new Date(period.period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${period.status === 'closed' ? 'bg-gray-800 text-gray-400' : 'bg-green-900/40 text-green-400 border border-green-800'}`}>
              {period.status}
            </span>
            {incompleteCount > 0 && (
              <span className="text-red-400 text-xs">⚠ {incompleteCount} missing clock-out</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {period.status === 'open' && (
            <button onClick={handleRecalculate} disabled={isPending}
              className="bg-blue-700 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">
              {isPending ? 'Working…' : 'Recalculate Hours'}
            </button>
          )}
          <button onClick={handleExport} disabled={isPending || records.length === 0}
            className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">
            Export CSV
          </button>
          {period.status === 'open' && (
            <button onClick={handleClose} disabled={isPending}
              className="bg-red-700 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">
              Close Period
            </button>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-white">{records.length}</p>
          <p className="text-gray-500 text-xs">Daily Records</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-400">{totalRegular.toFixed(1)}</p>
          <p className="text-gray-500 text-xs">Regular Hours</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-orange-400">{totalOT.toFixed(1)}</p>
          <p className="text-gray-500 text-xs">Overtime Hours</p>
        </div>
      </div>

      {error  && <div className="bg-red-900/30 border border-red-800 rounded-xl p-3 text-red-300 text-sm">{error}</div>}
      {success && <div className="bg-green-900/30 border border-green-800 rounded-xl p-3 text-green-300 text-sm">{success}</div>}

      {/* Per-employee breakdown */}
      {records.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          No records yet. Click &quot;Recalculate Hours&quot; to generate from shift data.
        </div>
      )}

      {Object.entries(byEmployee).sort(([a], [b]) => a.localeCompare(b)).map(([name, empRecords]) => {
        const empReg  = empRecords.reduce((s, r) => s + r.regular_hours, 0)
        const empOT   = empRecords.reduce((s, r) => s + r.overtime_hours, 0)
        const empPTO  = empRecords.reduce((s, r) => s + r.pto_hours, 0)
        const empTotal = empRecords.reduce((s, r) => s + r.total_paid_hours, 0)
        return (
          <div key={name} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-800/50 flex items-center justify-between">
              <span className="text-white font-semibold">{name}</span>
              <div className="flex gap-4 text-sm">
                <span className="text-gray-400">Reg: <span className="text-blue-400 font-mono">{empReg.toFixed(1)}</span></span>
                <span className="text-gray-400">OT: <span className="text-orange-400 font-mono">{empOT.toFixed(1)}</span></span>
                {empPTO > 0 && <span className="text-gray-400">PTO: <span className="text-purple-400 font-mono">{empPTO.toFixed(1)}</span></span>}
                <span className="text-gray-400">Total: <span className="text-white font-mono font-bold">{empTotal.toFixed(1)}</span></span>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-500 px-4 py-2 font-normal text-xs">Date</th>
                  <th className="text-right text-gray-500 px-3 py-2 font-normal text-xs">Regular</th>
                  <th className="text-right text-gray-500 px-3 py-2 font-normal text-xs">OT</th>
                  <th className="text-right text-gray-500 px-3 py-2 font-normal text-xs">PTO</th>
                  <th className="text-right text-gray-500 px-3 py-2 font-normal text-xs">Total</th>
                  <th className="text-right text-gray-500 px-3 py-2 font-normal text-xs">Missed Breaks</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {empRecords.sort((a, b) => a.work_date.localeCompare(b.work_date)).map(r => (
                  <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-2 text-gray-300">
                      {new Date(r.work_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {r.is_incomplete && <span className="ml-2 text-red-400 text-xs">⚠ missing</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-blue-300">{r.regular_hours.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-orange-300">{r.overtime_hours > 0 ? r.overtime_hours.toFixed(2) : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-purple-300">{r.pto_hours > 0 ? r.pto_hours.toFixed(2) : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-white font-semibold">{r.total_paid_hours.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-gray-400">{r.missed_breaks > 0 ? <span className="text-red-400">{r.missed_breaks}</span> : '—'}</td>
                    <td className="px-3 py-2 text-right">
                      {period.status === 'open' && (
                        <button onClick={() => setEditingId(r.id)} className="text-gray-600 hover:text-gray-300 text-xs">edit</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
