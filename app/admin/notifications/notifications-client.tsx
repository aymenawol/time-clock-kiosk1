'use client'

import { useState } from 'react'

interface NotificationLog {
  id:            string
  recipient_name: string
  event_type:    string
  channel:       string
  sent_at:       string
  delivered_at:  string | null
  failed:        boolean
  failure_reason: string | null
}

export default function NotificationsClient({ logs: initial }: { logs: NotificationLog[] }) {
  const [logs]                          = useState(initial)
  const [filterChannel, setFilterChannel] = useState<string>('all')
  const [filterFailed, setFilterFailed] = useState(false)
  const [search, setSearch]             = useState('')

  const filtered = logs.filter(l => {
    if (filterChannel !== 'all' && l.channel !== filterChannel) return false
    if (filterFailed && !l.failed) return false
    if (search && !l.recipient_name.toLowerCase().includes(search.toLowerCase()) &&
        !l.event_type.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalFailed = logs.filter(l => l.failed).length

  function exportCsv() {
    const header = 'Recipient,Event Type,Channel,Sent At,Delivered At,Failed,Failure Reason'
    const rows   = filtered.map(l =>
      [l.recipient_name, l.event_type, l.channel, l.sent_at, l.delivered_at ?? '', l.failed, l.failure_reason ?? '']
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    )
    const csv  = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'notification-log.csv' })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="text-foreground font-bold text-2xl">{logs.length}</div>
          <div className="text-muted-foreground text-sm">Total notifications</div>
        </div>
        <div className="bg-green-950/40 border border-green-800 rounded-xl p-4 text-center">
          <div className="text-green-400 font-bold text-2xl">{logs.length - totalFailed}</div>
          <div className="text-muted-foreground text-sm">Delivered</div>
        </div>
        <div className="bg-red-950/40 border border-red-800 rounded-xl p-4 text-center">
          <div className="text-red-400 font-bold text-2xl">{totalFailed}</div>
          <div className="text-muted-foreground text-sm">Failed</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search recipient or event…"
          className="bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm w-56"
        />
        <select
          value={filterChannel}
          onChange={e => setFilterChannel(e.target.value)}
          className="bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm"
        >
          <option value="all">All channels</option>
          <option value="sms">SMS</option>
          <option value="push">Push / Email</option>
          <option value="in_app">In-App</option>
        </select>
        <label className="flex items-center gap-2 text-muted-foreground text-sm cursor-pointer">
          <input type="checkbox" checked={filterFailed} onChange={e => setFilterFailed(e.target.checked)} />
          Failures only
        </label>
        <div className="ml-auto">
          <button
            onClick={exportCsv}
            className="bg-muted hover:bg-gray-700 text-foreground text-sm px-4 py-2 rounded-lg border border-border"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="text-muted-foreground text-xs mb-2">{filtered.length} records</div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs">
              <th className="text-left px-4 py-3">Recipient</th>
              <th className="text-left px-4 py-3">Event</th>
              <th className="text-left px-4 py-3">Channel</th>
              <th className="text-left px-4 py-3">Sent At</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Failure Reason</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted-foreground py-10">No records</td>
              </tr>
            )}
            {filtered.slice(0, 500).map(l => (
              <tr key={l.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="px-4 py-2.5 text-foreground">{l.recipient_name}</td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">{l.event_type.replace(/_/g, ' ')}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    l.channel === 'sms'    ? 'bg-green-900 text-green-300' :
                    l.channel === 'push'   ? 'bg-blue-900 text-blue-300'  :
                                            'bg-muted text-muted-foreground'
                  }`}>
                    {l.channel}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">
                  {new Date(l.sent_at).toLocaleString('en-US', { hour12: false })}
                </td>
                <td className="px-4 py-2.5">
                  {l.failed ? (
                    <span className="text-xs text-red-400 font-medium">Failed</span>
                  ) : l.delivered_at ? (
                    <span className="text-xs text-green-400">Delivered</span>
                  ) : (
                    <span className="text-xs text-yellow-400">Sent</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-red-400 text-xs">{l.failure_reason ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
