'use client'

import { useState, useTransition } from 'react'
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

const TYPE_COLOR: Record<string, string> = {
  single_shift:     'border-orange-700 bg-orange-950/20',
  consecutive_days: 'border-yellow-700 bg-yellow-950/20',
  ot_threshold:     'border-red-700 bg-red-950/20',
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
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Fatigue Monitoring</h1>
          {unresolved > 0 && (
            <p className="text-red-400 text-sm mt-0.5">{unresolved} unresolved alert{unresolved > 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(['unresolved', 'all', 'resolved'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${filter === s ? 'bg-white text-gray-900 border-white' : 'text-gray-400 border-gray-700 hover:text-white'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <div className="border-l border-gray-700 mx-1" />
        {(['all', 'single_shift', 'consecutive_days', 'ot_threshold'] as const).map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${typeFilter === t ? 'bg-white text-gray-900 border-white' : 'text-gray-400 border-gray-700 hover:text-white'}`}>
            {t === 'all' ? 'All Types' : TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Action modal */}
      {actionId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setActionId(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-3 capitalize">{actionType} Alert</h3>
            <textarea
              value={noteText} onChange={e => setNoteText(e.target.value)}
              placeholder={actionType === 'resolve' ? 'Resolution notes…' : 'Reason for dismissal…'}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none mb-3" />
            <div className="flex gap-3">
              <button onClick={handleSubmit} disabled={isPending}
                className={`text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 ${
                  actionType === 'resolve' ? 'bg-green-700 hover:bg-green-600' : 'bg-yellow-700 hover:bg-yellow-600'
                }`}>
                {isPending ? 'Saving…' : actionType === 'resolve' ? 'Mark Resolved' : 'Dismiss'}
              </button>
              <button onClick={() => setActionId(null)} className="text-gray-400 hover:text-white text-sm px-4 py-2">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Alert list */}
      {filtered.length === 0 && (
        <p className="text-gray-500 text-center py-16">No fatigue alerts matching current filters.</p>
      )}

      <div className="space-y-3">
        {filtered.map(alert => {
          const isResolved  = !!alert.resolved_at
          const isDismissed = !!alert.dismissed_at
          const isActive    = !isResolved && !isDismissed
          return (
            <div key={alert.id} className={`border rounded-xl p-4 ${TYPE_COLOR[alert.alert_type] ?? 'border-gray-700 bg-gray-900'} ${!isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-semibold">{alert.employee_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLOR[alert.alert_type]}`}>
                      {TYPE_LABEL[alert.alert_type]}
                    </span>
                    {isResolved   && <span className="text-green-400 text-xs">✓ Resolved</span>}
                    {isDismissed  && <span className="text-yellow-400 text-xs">↷ Dismissed</span>}
                  </div>

                  {/* Context detail */}
                  {alert.shift_hours != null && (
                    <p className="text-gray-300 text-sm">Shift duration: <span className="font-semibold">{alert.shift_hours.toFixed(1)}h</span></p>
                  )}
                  {alert.consecutive_count != null && (
                    <p className="text-gray-300 text-sm">Consecutive days: <span className="font-semibold">{alert.consecutive_count}</span></p>
                  )}
                  {alert.weekly_ot_hours != null && (
                    <p className="text-gray-300 text-sm">Weekly OT hours: <span className="font-semibold">{alert.weekly_ot_hours.toFixed(1)}h</span></p>
                  )}

                  <p className="text-gray-500 text-xs mt-1">
                    Triggered {new Date(alert.triggered_at).toLocaleString()}
                  </p>

                  {isResolved && alert.notes && (
                    <p className="text-gray-400 text-xs mt-1">Resolution: {alert.notes}</p>
                  )}
                  {isDismissed && alert.dismiss_reason && (
                    <p className="text-gray-400 text-xs mt-1">Dismissed: {alert.dismiss_reason}</p>
                  )}
                </div>

                {isActive && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => openAction(alert.id, 'resolve')}
                      className="bg-green-800 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
                      Resolve
                    </button>
                    <button onClick={() => openAction(alert.id, 'dismiss')}
                      className="bg-yellow-800 hover:bg-yellow-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
                      Dismiss
                    </button>
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
