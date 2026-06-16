'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { submitCountingSheetAction } from './actions'

interface CountingRow {
  id?: string
  row_order: number
  departure_time: string
  rac: number
  t1: number
  t3: number
  term1: number
  term3_west: number
  term3_east: number
}

interface Break {
  id: string
  break_number: 1 | 2
  status: string
  actual_start: string | null
  duration_minutes: number
}

interface Props {
  employee: { id: string; name: string } | null
  shift: { id: string; date: string; status: string; bus: { id: string; bus_number: string } | null; breaks: Break[] } | null
  existingSheet: any | null
  existingRows: CountingRow[]
  today: string
}

const BLANK_ROW: () => Omit<CountingRow, 'row_order'> = () => ({
  departure_time: '', rac: 0, t1: 0, t3: 0, term1: 0, term3_west: 0, term3_east: 0,
})

function rowTotal(r: Omit<CountingRow, 'row_order' | 'departure_time'>) {
  return r.rac + r.t1 + r.t3 + r.term1 + r.term3_west + r.term3_east
}

function useBreakTimer(activeBreak: Break | null) {
  const [remaining, setRemaining] = useState<number | null>(null)
  useEffect(() => {
    if (!activeBreak?.actual_start) { setRemaining(null); return }
    const end = new Date(activeBreak.actual_start).getTime() + activeBreak.duration_minutes * 60_000
    const update = () => setRemaining(Math.max(0, Math.floor((end - Date.now()) / 1000)))
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [activeBreak])
  return remaining
}

export default function CountingSheetClient({ employee, shift, existingSheet, existingRows, today }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [sheetId, setSheetId] = useState<string | null>(existingSheet?.id ?? null)
  const [submitted, setSubmitted] = useState(existingSheet?.status === 'submitted')

  const initRows = existingRows.length > 0
    ? existingRows.map(r => ({ ...r } as CountingRow))
    : Array.from({ length: 10 }, (_, i) => ({ row_order: i + 1, ...BLANK_ROW() }))

  const [rows, setRows] = useState<CountingRow[]>(initRows)

  const activeBreak = shift?.breaks.find(b => b.status === 'active') ?? null
  const breakTimer  = useBreakTimer(activeBreak)

  function updateCell(rowIdx: number, field: keyof CountingRow, value: string | number) {
    setRows(prev => {
      const next = [...prev]
      next[rowIdx] = { ...next[rowIdx], [field]: value }
      return next
    })
  }

  function addRow() {
    setRows(prev => [...prev, { row_order: prev.length + 1, ...BLANK_ROW() }])
  }

  function deleteRow(idx: number) {
    setRows(prev => prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, row_order: i + 1 })))
  }

  // Returns the sheet id on success, the literal 'offline' when queued locally,
  // or undefined on a hard error.
  async function saveSheet(): Promise<string | undefined> {
    if (!shift || !employee) return

    const nonEmpty = rows.filter(r => r.departure_time || rowTotal(r) > 0)
    const rowsPayload = nonEmpty.map((r, i) => ({
      row_order:      i + 1,
      departure_time: r.departure_time || null,
      rac:            r.rac,
      t1:             r.t1,
      t3:             r.t3,
      term1:          r.term1,
      term3_west:     r.term3_west,
      term3_east:     r.term3_east,
    }))

    const sheetPayload = {
      shift_id:   shift.id,
      date:       today,
      driver_id:  employee.id,
      bus_id:     shift.bus?.id ?? null,
      status:     'draft',
      start_time: new Date().toISOString(),
    }

    async function queueOffline() {
      const { queueWrite } = await import('@/lib/indexed-db')
      await queueWrite('pending_counting_sheet_rows', `cs-${shift!.id}`, { sheet: sheetPayload, rows: rowsPayload })
      return 'offline' as const
    }

    // Offline → persist locally; DriverShell drains the queue on reconnect.
    if (typeof navigator !== 'undefined' && !navigator.onLine) return queueOffline()

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    try {
      let currentSheetId = sheetId
      if (!currentSheetId) {
        const { data, error: sheetErr } = await supabase
          .from('counting_sheets')
          .insert(sheetPayload)
          .select('id')
          .single()
        if (sheetErr) throw sheetErr
        currentSheetId = data.id
        setSheetId(currentSheetId)
      }

      // Upsert rows (delete all and re-insert for simplicity)
      await supabase.from('counting_rows').delete().eq('sheet_id', currentSheetId)
      if (rowsPayload.length > 0) {
        const { error: insErr } = await supabase
          .from('counting_rows')
          .insert(rowsPayload.map(r => ({ ...r, sheet_id: currentSheetId })))
        if (insErr) throw insErr
      }
      return currentSheetId ?? undefined
    } catch (e) {
      // Network failure mid-save → fall back to the offline queue rather than lose data.
      if (typeof navigator !== 'undefined' && !navigator.onLine) return queueOffline()
      setError(e instanceof Error ? e.message : 'Failed to save')
      return undefined
    }
  }

  function handleSaveDraft() {
    setError('')
    startTransition(async () => {
      const id = await saveSheet()
      // 'offline' → saved to the local queue; the offline banner already informs the driver.
      if (id && id !== 'offline') router.refresh()
    })
  }

  function handleSubmit() {
    if (!confirm('Submit counting sheet? This cannot be undone.')) return
    setError('')
    startTransition(async () => {
      const id = await saveSheet()
      if (!id) return
      if (id === 'offline') {
        setError('You are offline — the sheet was saved on this device. Submit again once you reconnect.')
        return
      }
      const driverName = employee ? employee.name : 'Driver'
      const result = await submitCountingSheetAction(id, driverName)
      if (result.error) setError(result.error)
      else { setSubmitted(true); router.refresh() }
    })
  }

  // Column totals
  const totals = {
    rac:       rows.reduce((s, r) => s + (r.rac || 0), 0),
    t1:        rows.reduce((s, r) => s + (r.t1 || 0), 0),
    t3:        rows.reduce((s, r) => s + (r.t3 || 0), 0),
    term1:     rows.reduce((s, r) => s + (r.term1 || 0), 0),
    term3_west:rows.reduce((s, r) => s + (r.term3_west || 0), 0),
    term3_east:rows.reduce((s, r) => s + (r.term3_east || 0), 0),
  }
  const grandTotal = rowTotal(totals)

  if (!employee || !shift) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>No active shift found for today.</p>
        <a href="/driver" className="text-blue-400 hover:underline text-sm mt-2 block">← Back to dashboard</a>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <a href="/driver" className="text-xs text-muted-foreground hover:text-foreground">← Dashboard</a>
          <h1 className="text-xl font-bold text-foreground mt-0.5">Passenger Counting Sheet</h1>
        </div>
        {submitted && (
          <span className="bg-green-900 text-green-300 text-xs font-semibold px-3 py-1 rounded-full">Submitted</span>
        )}
      </div>

      {/* Break timer banner */}
      {activeBreak && (
        <div className={`rounded-xl border-2 p-3 text-center ${breakTimer && breakTimer <= 0 ? 'border-red-500 bg-red-950/40' : 'border-yellow-600 bg-yellow-950/40'}`}>
          <p className="text-yellow-300 text-sm font-semibold">
            Break {activeBreak.break_number} — {breakTimer !== null ? `${Math.floor(breakTimer/60)}:${(breakTimer%60).toString().padStart(2,'0')} remaining` : '…'}
            {breakTimer !== null && breakTimer <= 0 && <span className="text-red-400 ml-2">⚠ RETURN NOW</span>}
          </p>
        </div>
      )}

      {/* Info bar */}
      <div className="bg-card border border-border rounded-xl p-3 flex gap-6 text-sm">
        <div><p className="text-muted-foreground text-xs">Driver</p><p className="text-foreground">{employee.name}</p></div>
        <div><p className="text-muted-foreground text-xs">Bus</p><p className="text-foreground">{shift.bus ? `#${shift.bus.bus_number}` : '—'}</p></div>
        <div><p className="text-muted-foreground text-xs">Date</p><p className="text-foreground">{today}</p></div>
      </div>

      {error && <div className="bg-red-900/40 border border-red-600 text-red-300 rounded p-3 text-sm">{error}</div>}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-card text-muted-foreground text-xs uppercase">
              <th className="px-2 py-2 w-8">#</th>
              <th className="px-2 py-2 text-left">Depart</th>
              <th className="px-2 py-2 text-center">RAC</th>
              <th className="px-2 py-2 text-center">T1</th>
              <th className="px-2 py-2 text-center">T3</th>
              <th className="px-2 py-2 text-center">Term1</th>
              <th className="px-2 py-2 text-center">T3W</th>
              <th className="px-2 py-2 text-center">T3E</th>
              <th className="px-2 py-2 text-center font-bold text-foreground">Total</th>
              {!submitted && <th className="px-2 py-2 w-8" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-card/30">
                <td className="px-2 py-1 text-gray-600 text-xs text-center">{idx + 1}</td>
                <td className="px-1 py-1">
                  <input
                    type="time"
                    value={row.departure_time}
                    disabled={submitted}
                    onChange={e => updateCell(idx, 'departure_time', e.target.value)}
                    className="bg-transparent border border-border text-foreground text-xs rounded px-1 py-0.5 w-24 disabled:opacity-50"
                  />
                </td>
                {(['rac','t1','t3','term1','term3_west','term3_east'] as const).map(field => (
                  <td key={field} className="px-1 py-1">
                    <input
                      type="number"
                      min="0"
                      value={row[field] || ''}
                      disabled={submitted}
                      onChange={e => updateCell(idx, field, parseInt(e.target.value) || 0)}
                      className="bg-transparent border border-border text-foreground text-xs rounded px-1 py-0.5 w-12 text-center disabled:opacity-50"
                    />
                  </td>
                ))}
                <td className="px-2 py-1 text-center font-bold text-foreground">
                  {rowTotal(row) || ''}
                </td>
                {!submitted && (
                  <td className="px-1 py-1">
                    <button
                      onClick={() => deleteRow(idx)}
                      className="text-gray-700 hover:text-red-400 text-xs"
                    >✕</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-card/60 font-bold text-foreground text-xs">
              <td className="px-2 py-2" colSpan={2}>TOTALS</td>
              {(['rac','t1','t3','term1','term3_west','term3_east'] as const).map(f => (
                <td key={f} className="px-2 py-2 text-center">{totals[f] || ''}</td>
              ))}
              <td className="px-2 py-2 text-center text-blue-300 text-base">{grandTotal || ''}</td>
              {!submitted && <td />}
            </tr>
          </tfoot>
        </table>
      </div>

      {!submitted && (
        <div className="flex gap-3">
          <button onClick={addRow} className="bg-muted hover:bg-gray-700 text-foreground text-sm px-4 py-2 rounded-lg">
            + Add Row
          </button>
          <button onClick={handleSaveDraft} disabled={isPending} className="bg-muted hover:bg-gray-700 disabled:opacity-50 text-foreground text-sm px-4 py-2 rounded-lg">
            {isPending ? 'Saving…' : 'Save Draft'}
          </button>
          <button onClick={handleSubmit} disabled={isPending} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-foreground text-sm font-medium px-4 py-2 rounded-lg ml-auto">
            Submit Sheet
          </button>
        </div>
      )}
    </div>
  )
}
