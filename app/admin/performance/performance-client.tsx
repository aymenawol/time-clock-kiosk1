'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface Snapshot {
  snapshot_date:            string
  attendance_status:        string
  missed_breaks_count:      number
  safety_meetings_attended: number
  safety_meetings_missed:   number
  inspections_completed:    number
  inspections_missed:       number
}

interface Employee {
  id:         string
  name:       string
  role:       string
  snapshots:  Snapshot[]
}

function pct(num: number, denom: number) {
  if (denom === 0) return 100
  return Math.round((num / denom) * 100)
}

function color(val: number) {
  if (val >= 80) return 'text-ok'
  if (val >= 60) return 'text-warn'
  return 'text-danger'
}

function badge(val: number) {
  if (val >= 80) return 'bg-ok-surface text-ok border border-ok-border'
  if (val >= 60) return 'bg-warn-surface text-warn border border-warn-border'
  return 'bg-danger-surface text-danger border border-danger-border'
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-3 text-center">
      <div className="text-foreground font-bold text-xl">{value}</div>
      <div className="text-muted-foreground text-xs mt-0.5">{label}</div>
    </Card>
  )
}

function aggregateSnapshots(snapshots: Snapshot[], days: number) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const filtered = snapshots.filter(s => s.snapshot_date >= cutoff)
  if (!filtered.length) return null

  const attended     = filtered.reduce((s, x) => s + (x.attendance_status === 'present' || x.attendance_status === 'late' ? 1 : 0), 0)
  const lates        = filtered.reduce((s, x) => s + (x.attendance_status === 'late' ? 1 : 0), 0)
  const absences     = filtered.reduce((s, x) => s + (x.attendance_status === 'absent' ? 1 : 0), 0)
  const missedBreaks = filtered.reduce((s, x) => s + x.missed_breaks_count, 0)
  const safetyAtt    = filtered.reduce((s, x) => s + x.safety_meetings_attended, 0)
  const safetytot    = filtered.reduce((s, x) => s + x.safety_meetings_attended + x.safety_meetings_missed, 0)
  const inspComp     = filtered.reduce((s, x) => s + x.inspections_completed, 0)
  const inspTotal    = filtered.reduce((s, x) => s + x.inspections_completed + x.inspections_missed, 0)

  return {
    total:         filtered.length,
    attendancePct: pct(attended, filtered.length),
    lates,
    absences,
    missedBreaks,
    safetyPct:     pct(safetyAtt, safetytot),
    inspPct:       pct(inspComp, inspTotal),
  }
}

export default function PerformanceClient({ employees }: { employees: Employee[] }) {
  const [search, setSearch]             = useState('')
  const [period, setPeriod]             = useState<30 | 60 | 90>(30)
  const [expandedId, setExpandedId]     = useState<string | null>(null)

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search employee…"
          className="w-full sm:w-56"
        />
        <div className="flex gap-1">
          {([30, 60, 90] as const).map(d => (
            <Button
              key={d}
              variant={period === d ? 'default' : 'outline'}
              onClick={() => setPeriod(d)}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="text-muted-foreground text-center py-12">No employees found</p>
        )}
        {filtered.map(emp => {
          const agg      = aggregateSnapshots(emp.snapshots, period)
          const expanded = expandedId === emp.id
          return (
            <Card key={emp.id} className="overflow-hidden">
              <button
                onClick={() => setExpandedId(expanded ? null : emp.id)}
                className="w-full text-left px-5 py-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-foreground font-medium truncate">{emp.name}</div>
                  <div className="text-muted-foreground text-xs capitalize">{emp.role}</div>
                </div>
                {agg ? (
                  <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                    <span className={`text-sm px-2 py-0.5 rounded-full ${badge(agg.attendancePct)}`}>
                      Att: {agg.attendancePct}%
                    </span>
                    <span className={`text-sm px-2 py-0.5 rounded-full ${badge(agg.safetyPct)}`}>
                      Safety: {agg.safetyPct}%
                    </span>
                    <span className={`text-sm px-2 py-0.5 rounded-full ${badge(agg.inspPct)}`}>
                      Insp: {agg.inspPct}%
                    </span>
                    {expanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm shrink-0">No data</span>
                )}
              </button>

              {expanded && agg && (
                <div className="border-t border-border px-5 py-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                    <MetricCard label={`Attendance (${period}d)`} value={`${agg.attendancePct}%`} />
                    <MetricCard label="Late arrivals" value={agg.lates} />
                    <MetricCard label="Absences" value={agg.absences} />
                    <MetricCard label="Missed breaks" value={agg.missedBreaks} />
                    <MetricCard label="Safety meetings" value={`${agg.safetyPct}%`} />
                    <MetricCard label="Inspections" value={`${agg.inspPct}%`} />
                    <MetricCard label="Shifts tracked" value={agg.total} />
                  </div>

                  {/* Trend: last 10 snapshots */}
                  <div>
                    <p className="text-muted-foreground text-xs mb-2">Recent shifts</p>
                    <div className="space-y-1">
                      {emp.snapshots.slice(0, 10).map((s, i) => (
                        <div key={i} className="flex items-center gap-3 text-xs">
                          <span className="text-muted-foreground w-24 shrink-0">{s.snapshot_date}</span>
                          <span className={`w-16 shrink-0 ${color(s.attendance_status === 'present' ? 100 : s.attendance_status === 'late' ? 70 : 0)}`}>
                            {s.attendance_status}
                          </span>
                          {s.missed_breaks_count > 0 && (
                            <span className="text-danger">{s.missed_breaks_count} missed break{s.missed_breaks_count > 1 ? 's' : ''}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
