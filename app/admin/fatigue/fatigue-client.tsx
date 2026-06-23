'use client'

import { useState, useTransition } from 'react'
import { Check, CornerUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { resolveAlertAction, dismissAlertAction } from './actions'

interface FatigueAlert {
  id: string
  employee_id: string
  employee_name: string
  alert_type: 'single_shift' | 'consecutive_days' | 'ot_threshold'
  shift_hours: number | null
  consecutive_count: number | null
  weekly_ot_hours: number | null
  triggered_at: string
  resolved_at: string | null
  resolved_by_name: string | null
  notes: string | null
  dismissed_at: string | null
  dismiss_reason: string | null
}

interface Props { alerts: FatigueAlert[] }

const TYPE_LABEL: Record<string, string> = {
  single_shift:     'Long Shift (>10h)',
  consecutive_days: 'Consecutive Days',
  ot_threshold:     'OT Threshold Exceeded',
}

const TYPE_VARIANT: Record<string, BadgeProps['variant']> = {
  single_shift:     'warn',
  consecutive_days: 'warn',
  ot_threshold:     'danger',
}

const TYPE_CARD: Record<string, string> = {
  single_shift:     'border-warn-border bg-warn-surface',
  consecutive_days: 'border-warn-border bg-warn-surface',
  ot_threshold:     'border-danger-border bg-danger-surface',
}

export default function FatigueClient({ alerts }: Props) {
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved'>('unresolved')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [isPending, startTransition] = useTransition()
  const [actionId, setActionId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [actionType, setActionType] = useState<'resolve' | 'dismiss' | null>(null)

  const filtered = alerts.filter(a => {
    if (filter === 'unresolved' && (a.resolved_at || a.dismissed_at)) return false
    if (filter === 'resolved' && !a.resolved_at && !a.dismissed_at) return false
    if (typeFilter !== 'all' && a.alert_type !== typeFilter) return false
    return true
  })

  const unresolved = alerts.filter(a => !a.resolved_at && !a.dismissed_at).length

  function openAction(id: string, type: 'resolve' | 'dismiss') {
    setActionId(id)
    setActionType(type)
    setNoteText('')
  }

  function handleSubmit() {
    if (!actionId || !actionType) return
    if (!noteText.trim()) { alert('Please provide a note.'); return }

    startTransition(async () => {
      if (actionType === 'resolve') {
        await resolveAlertAction(actionId, noteText)
      } else {
        await dismissAlertAction(actionId, noteText)
      }
      setActionId(null)
      setActionType(null)
      setNoteText('')
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fatigue Monitoring</h1>
          {unresolved > 0 && (
            <p className="text-danger text-sm mt-0.5">{unresolved} unresolved alert{unresolved > 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {(['unresolved', 'all', 'resolved'] as const).map(s => (
          <Button key={s} variant={filter === s ? 'default' : 'outline'} size="sm" onClick={() => setFilter(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
        <div className="border-l border-border h-6 mx-1" />
        {(['all', 'single_shift', 'consecutive_days', 'ot_threshold'] as const).map(t => (
          <Button key={t} variant={typeFilter === t ? 'default' : 'outline'} size="sm" onClick={() => setTypeFilter(t)}>
            {t === 'all' ? 'All Types' : TYPE_LABEL[t]}
          </Button>
        ))}
      </div>

      {/* Action modal */}
      {actionId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setActionId(null)}>
          <div className="bg-card border border-border rounded-xl p-5 w-[92vw] max-w-md shadow-lg" onClick={e => e.stopPropagation()}>
            <h3 className="text-foreground font-semibold mb-3 capitalize">{actionType} Alert</h3>
            <Textarea
              value={noteText} onChange={e => setNoteText(e.target.value)}
              placeholder={actionType === 'resolve' ? 'Resolution notes…' : 'Reason for dismissal…'}
              rows={3}
              className="resize-none mb-3" />
            <div className="flex gap-3">
              <Button onClick={handleSubmit} disabled={isPending}
                variant={actionType === 'resolve' ? 'success' : 'default'}
                className={actionType === 'dismiss' ? 'bg-warn text-white hover:bg-warn/90' : undefined}>
                {isPending ? 'Saving…' : actionType === 'resolve' ? 'Mark Resolved' : 'Dismiss'}
              </Button>
              <Button variant="ghost" onClick={() => setActionId(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Alert list */}
      {filtered.length === 0 && (
        <p className="text-muted-foreground text-center py-16">No fatigue alerts matching current filters.</p>
      )}

      <div className="space-y-3">
        {filtered.map(alert => {
          const isResolved  = !!alert.resolved_at
          const isDismissed = !!alert.dismissed_at
          const isActive    = !isResolved && !isDismissed
          return (
            <div key={alert.id} className={`border rounded-xl p-4 ${TYPE_CARD[alert.alert_type] ?? 'border-border bg-card'} ${!isActive ? 'opacity-60' : ''}`}>
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-foreground font-semibold">{alert.employee_name}</span>
                    <Badge variant={TYPE_VARIANT[alert.alert_type] ?? 'neutral'}>
                      {TYPE_LABEL[alert.alert_type]}
                    </Badge>
                    {isResolved   && <span className="text-ok text-xs inline-flex items-center gap-1"><Check className="size-3.5" /> Resolved</span>}
                    {isDismissed  && <span className="text-warn text-xs inline-flex items-center gap-1"><CornerUpRight className="size-3.5" /> Dismissed</span>}
                  </div>

                  {/* Context detail */}
                  {alert.shift_hours != null && (
                    <p className="text-foreground text-sm">Shift duration: <span className="font-semibold">{alert.shift_hours.toFixed(1)}h</span></p>
                  )}
                  {alert.consecutive_count != null && (
                    <p className="text-foreground text-sm">Consecutive days: <span className="font-semibold">{alert.consecutive_count}</span></p>
                  )}
                  {alert.weekly_ot_hours != null && (
                    <p className="text-foreground text-sm">Weekly OT hours: <span className="font-semibold">{alert.weekly_ot_hours.toFixed(1)}h</span></p>
                  )}

                  <p className="text-muted-foreground text-xs mt-1">
                    Triggered {new Date(alert.triggered_at).toLocaleString()}
                  </p>

                  {isResolved && alert.notes && (
                    <p className="text-muted-foreground text-xs mt-1">Resolution: {alert.notes}</p>
                  )}
                  {isDismissed && alert.dismiss_reason && (
                    <p className="text-muted-foreground text-xs mt-1">Dismissed: {alert.dismiss_reason}</p>
                  )}
                </div>

                {isActive && (
                  <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                    <Button variant="success" size="sm" onClick={() => openAction(alert.id, 'resolve')}>
                      Resolve
                    </Button>
                    <Button size="sm" className="bg-warn text-white hover:bg-warn/90" onClick={() => openAction(alert.id, 'dismiss')}>
                      Dismiss
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
