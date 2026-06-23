'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, RefreshCw, Download, Lock } from 'lucide-react'
import { calculatePayPeriodHoursAction, closePayPeriodAction, correctDailyHoursAction, logPayrollExportAction } from '../actions'
import { buildPayrollCSV } from '@/lib/payroll-calc'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

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
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setEditingId(null)}>
        <Card className="w-[92vw] max-w-md p-5" onClick={e => e.stopPropagation()}>
          <h3 className="text-foreground font-semibold mb-1">Correct Hours — {record.employee_name}</h3>
          <p className="text-muted-foreground text-sm mb-4">{record.work_date}</p>
          <div className="grid grid-cols-1 gap-3 mb-3 sm:grid-cols-3">
            {([['Regular', reg, setReg], ['OT', ot, setOt], ['PTO', pto, setPto]] as const).map(([label, val, setter]) => (
              <div key={label} className="space-y-1">
                <Label>{label} hrs</Label>
                <Input type="number" step="0.25" min="0" value={val}
                  onChange={e => setter(e.target.value)} />
              </div>
            ))}
          </div>
          <div className="mb-4 space-y-1">
            <Label htmlFor="correction-reason">Reason (required)</Label>
            <Textarea id="correction-reason" value={reason} onChange={e => setReason(e.target.value)} rows={2}
              className="min-h-0 resize-none" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSave} disabled={isPending}>
              Save Correction
            </Button>
            <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
          </div>
        </Card>
      </div>
    )
  }

  // Group records by employee
  const byEmployee: Record<string, DailyRecord[]> = {}
  for (const r of records) {
    byEmployee[r.employee_name] = [...(byEmployee[r.employee_name] ?? []), r]
  }

  return (
    <div className="space-y-5">
      {editingId && (() => {
        const rec = records.find(r => r.id === editingId)
        return rec ? <CorrectionModal record={rec} /> : null
      })()}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/admin/payroll" className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground">
            <ArrowLeft className="size-4" /> Payroll
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-1">
            {new Date(period.period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' — '}
            {new Date(period.period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <Badge variant={period.status === 'closed' ? 'neutral' : 'ok'}>
              {period.status}
            </Badge>
            {incompleteCount > 0 && (
              <span className="inline-flex items-center gap-1 text-danger text-xs">
                <AlertTriangle className="size-3.5" /> {incompleteCount} missing clock-out
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {period.status === 'open' && (
            <Button variant="outline" size="sm" onClick={handleRecalculate} disabled={isPending}>
              <RefreshCw />
              {isPending ? 'Working…' : 'Recalculate Hours'}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={handleExport} disabled={isPending || records.length === 0}>
            <Download />
            Export CSV
          </Button>
          {period.status === 'open' && (
            <Button variant="destructive" size="sm" onClick={handleClose} disabled={isPending}>
              <Lock />
              Close Period
            </Button>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{records.length}</p>
          <p className="text-muted-foreground text-xs">Daily Records</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-info">{totalRegular.toFixed(1)}</p>
          <p className="text-muted-foreground text-xs">Regular Hours</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-warn">{totalOT.toFixed(1)}</p>
          <p className="text-muted-foreground text-xs">Overtime Hours</p>
        </Card>
      </div>

      {error  && <div className="bg-danger-surface border border-danger-border rounded-xl p-3 text-danger text-sm">{error}</div>}
      {success && <div className="bg-ok-surface border border-ok-border rounded-xl p-3 text-ok text-sm">{success}</div>}

      {/* Per-employee breakdown */}
      {records.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          No records yet. Click &quot;Recalculate Hours&quot; to generate from shift data.
        </div>
      )}

      {Object.entries(byEmployee).sort(([a], [b]) => a.localeCompare(b)).map(([name, empRecords]) => {
        const empReg  = empRecords.reduce((s, r) => s + r.regular_hours, 0)
        const empOT   = empRecords.reduce((s, r) => s + r.overtime_hours, 0)
        const empPTO  = empRecords.reduce((s, r) => s + r.pto_hours, 0)
        const empTotal = empRecords.reduce((s, r) => s + r.total_paid_hours, 0)
        return (
          <Card key={name} className="overflow-hidden">
            <div className="px-4 py-3 bg-muted/50 flex flex-wrap items-center justify-between gap-2">
              <span className="text-foreground font-semibold">{name}</span>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-muted-foreground">Reg: <span className="text-info font-mono">{empReg.toFixed(1)}</span></span>
                <span className="text-muted-foreground">OT: <span className="text-warn font-mono">{empOT.toFixed(1)}</span></span>
                {empPTO > 0 && <span className="text-muted-foreground">PTO: <span className="text-hazard font-mono">{empPTO.toFixed(1)}</span></span>}
                <span className="text-muted-foreground">Total: <span className="text-foreground font-mono font-bold">{empTotal.toFixed(1)}</span></span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-muted-foreground px-4 py-2 font-normal text-xs">Date</th>
                    <th className="text-right text-muted-foreground px-3 py-2 font-normal text-xs">Regular</th>
                    <th className="text-right text-muted-foreground px-3 py-2 font-normal text-xs">OT</th>
                    <th className="text-right text-muted-foreground px-3 py-2 font-normal text-xs">PTO</th>
                    <th className="text-right text-muted-foreground px-3 py-2 font-normal text-xs">Total</th>
                    <th className="text-right text-muted-foreground px-3 py-2 font-normal text-xs">Missed Breaks</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {empRecords.sort((a, b) => a.work_date.localeCompare(b.work_date)).map(r => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-4 py-2 text-foreground whitespace-nowrap">
                        {new Date(r.work_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {r.is_incomplete && <span className="ml-2 inline-flex items-center gap-1 text-danger text-xs"><AlertTriangle className="size-3" /> missing</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-info">{r.regular_hours.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-mono text-warn">{r.overtime_hours > 0 ? r.overtime_hours.toFixed(2) : '—'}</td>
                      <td className="px-3 py-2 text-right font-mono text-hazard">{r.pto_hours > 0 ? r.pto_hours.toFixed(2) : '—'}</td>
                      <td className="px-3 py-2 text-right font-mono text-foreground font-semibold">{r.total_paid_hours.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{r.missed_breaks > 0 ? <span className="text-danger">{r.missed_breaks}</span> : '—'}</td>
                      <td className="px-3 py-2 text-right">
                        {period.status === 'open' && (
                          <button onClick={() => setEditingId(r.id)} className="text-muted-foreground hover:text-foreground text-xs">edit</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
