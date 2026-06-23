'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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

// Per-channel semantic colors mapped to operational ramps.
const CHANNEL_VARIANTS: Record<string, BadgeProps['variant']> = {
  sms:  'ok',
  push: 'info',
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-foreground font-bold text-2xl">{logs.length}</div>
            <div className="text-muted-foreground text-sm">Total notifications</div>
          </CardContent>
        </Card>
        <div className="rounded-xl border border-ok-border bg-ok-surface p-4 text-center">
          <div className="text-ok font-bold text-2xl">{logs.length - totalFailed}</div>
          <div className="text-muted-foreground text-sm">Delivered</div>
        </div>
        <div className="rounded-xl border border-danger-border bg-danger-surface p-4 text-center">
          <div className="text-danger font-bold text-2xl">{totalFailed}</div>
          <div className="text-muted-foreground text-sm">Failed</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search recipient or event…"
          className="w-full sm:w-56"
        />
        <select
          value={filterChannel}
          onChange={e => setFilterChannel(e.target.value)}
          className="h-10 rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:border-ring"
        >
          <option value="all">All channels</option>
          <option value="sms">SMS</option>
          <option value="push">Push / Email</option>
          <option value="in_app">In-App</option>
        </select>
        <Label className="flex items-center gap-2 text-muted-foreground font-normal">
          <input type="checkbox" checked={filterFailed} onChange={e => setFilterFailed(e.target.checked)} />
          Failures only
        </Label>
        <div className="sm:ml-auto">
          <Button onClick={exportCsv} variant="outline" size="sm" className="w-full sm:w-auto">
            <Download className="size-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="text-muted-foreground text-xs mb-2">{filtered.length} records</div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
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
                    <Badge variant={CHANNEL_VARIANTS[l.channel] ?? 'neutral'}>
                      {l.channel}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(l.sent_at).toLocaleString('en-US', { hour12: false })}
                  </td>
                  <td className="px-4 py-2.5">
                    {l.failed ? (
                      <span className="text-xs text-danger font-medium">Failed</span>
                    ) : l.delivered_at ? (
                      <span className="text-xs text-ok">Delivered</span>
                    ) : (
                      <span className="text-xs text-warn">Sent</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-danger text-xs">{l.failure_reason ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
