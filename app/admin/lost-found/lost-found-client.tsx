'use client'

import { useState, useTransition } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { transitionLostItemAction, type LostItemStatus } from './actions'

interface StatusHistory {
  old_status: string | null
  new_status: string
  changed_at: string
  notes:      string | null
  changer:    string
}

interface LostItem {
  id:                      string
  item_description:        string
  location_found:          string
  is_bag:                  boolean
  bag_contents:            string | null
  status:                  LostItemStatus
  found_at:                string
  collected_at:            string | null
  returned_to_dispatch_at: string | null
  claimed_at:              string | null
  claimant_name:           string | null
  disposed_at:             string | null
  disposal_reason:         string | null
  photo_paths:             string[]
  bus_number:              string
  reporter_name:           string
}

const STATUS_TRANSITIONS: Record<LostItemStatus, LostItemStatus[]> = {
  found:               ['collected', 'returned_to_dispatch'],
  collected:           ['returned_to_dispatch'],
  returned_to_dispatch: ['claimed', 'disposed'],
  claimed:             [],
  disposed:            [],
}

const STATUS_VARIANTS: Record<LostItemStatus, BadgeProps['variant']> = {
  found:               'info',
  collected:           'warn',
  returned_to_dispatch: 'warn',
  claimed:             'ok',
  disposed:            'neutral',
}

export default function LostFoundClient({ items: initialItems }: { items: LostItem[] }) {
  const [items, setItems]               = useState(initialItems)
  const [selected, setSelected]         = useState<LostItem | null>(null)
  const [filter, setFilter]             = useState<LostItemStatus | 'all'>('all')
  const [photoUrls, setPhotoUrls]       = useState<string[]>([])
  const [history, setHistory]           = useState<StatusHistory[]>([])
  const [isPending, startTransition]    = useTransition()
  const [transitionStatus, setTransitionStatus] = useState<LostItemStatus | null>(null)
  const [claimantName, setClaimantName] = useState('')
  const [disposalReason, setDisposalReason] = useState('')
  const [confirmAction, setConfirmAction] = useState(false)

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter)

  async function openItem(item: LostItem) {
    setSelected(item)
    setTransitionStatus(null)
    setConfirmAction(false)
    setClaimantName('')
    setDisposalReason('')
    setPhotoUrls([])
    setHistory([])

    if (item.photo_paths?.length) {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const urls = await Promise.all(item.photo_paths.map(async path => {
        const { data } = await supabase.storage.from('lost-and-found').createSignedUrl(path, 3600)
        return data?.signedUrl ?? ''
      }))
      setPhotoUrls(urls.filter(Boolean))
    }

    // Load status history
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: hist } = await supabase
      .from('lost_item_status_history')
      .select('old_status, new_status, changed_at, notes, employees!changed_by(name)')
      .eq('item_id', item.id)
      .order('changed_at', { ascending: false })

    setHistory(((hist ?? []) as unknown as Array<{
      old_status: string | null
      new_status: string
      changed_at: string
      notes: string | null
      employees: { name: string } | null
    }>).map((h) => ({
      old_status: h.old_status,
      new_status: h.new_status,
      changed_at: h.changed_at,
      notes:      h.notes,
      changer:    h.employees?.name ?? 'System',
    })))
  }

  function handleTransition() {
    if (!selected || !transitionStatus) return
    startTransition(async () => {
      const res = await transitionLostItemAction(selected.id, transitionStatus, {
        claimantName:  transitionStatus === 'claimed'   ? claimantName  : undefined,
        disposalReason: transitionStatus === 'disposed' ? disposalReason : undefined,
      })
      if ('error' in res) { alert(res.error); return }
      // Update local state
      const updated = { ...selected, status: transitionStatus }
      setItems(prev => prev.map(i => i.id === selected.id ? updated : i))
      setSelected(updated as LostItem)
      setTransitionStatus(null)
      setConfirmAction(false)
    })
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* List */}
      <div className="flex-1 min-w-0">
        {/* Filter bar */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['all', 'found', 'collected', 'returned_to_dispatch', 'claimed', 'disposed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                filter === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:bg-accent'
              }`}
            >
              {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
              {s !== 'all' && (
                <span className="ml-1.5 text-xs opacity-60">
                  {items.filter(i => i.status === s).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-muted-foreground text-center py-12">No items</div>
          )}
          {filtered.map(item => (
            <button
              key={item.id}
              onClick={() => openItem(item)}
              className={`w-full text-left bg-card border rounded-xl p-4 shadow-sm hover:bg-accent transition-colors ${
                selected?.id === item.id ? 'border-primary' : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-foreground text-sm font-medium truncate">{item.item_description}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">Bus {item.bus_number} · {item.location_found}</p>
                  <p className="text-muted-foreground text-xs">{new Date(item.found_at).toLocaleDateString()}</p>
                </div>
                <Badge variant={STATUS_VARIANTS[item.status]} className="shrink-0">
                  {item.status.replace(/_/g, ' ')}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <Card className="w-full lg:w-96 shrink-0 p-5 sm:p-6 space-y-5 lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-foreground font-semibold text-lg leading-tight min-w-0">{selected.item_description}</h3>
            <Button onClick={() => setSelected(null)} variant="ghost" size="icon-sm" className="shrink-0">
              <X className="size-4" />
            </Button>
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={STATUS_VARIANTS[selected.status]}>
                {selected.status.replace(/_/g, ' ')}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bus</span>
              <span className="text-foreground">{selected.bus_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Location found</span>
              <span className="text-foreground">{selected.location_found}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reported by</span>
              <span className="text-foreground">{selected.reporter_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Found at</span>
              <span className="text-foreground">{new Date(selected.found_at).toLocaleString('en-US', { hour12: false })}</span>
            </div>
            {selected.is_bag && (
              <div>
                <div className="text-muted-foreground mb-0.5">Bag contents</div>
                <div className="text-warn bg-warn-surface border border-warn-border rounded p-2 text-sm">
                  {selected.bag_contents}
                </div>
              </div>
            )}
          </div>

          {/* Photos */}
          {photoUrls.length > 0 && (
            <div>
              <p className="text-muted-foreground text-xs mb-2">Photos</p>
              <div className="flex flex-wrap gap-2">
                {photoUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" loading="lazy" decoding="async" className="w-20 h-20 object-cover rounded-lg" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Status transitions */}
          {STATUS_TRANSITIONS[selected.status].length > 0 && (
            <div className="border-t border-border pt-4">
              <p className="text-muted-foreground text-sm mb-2">Update Status</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {STATUS_TRANSITIONS[selected.status].map(s => (
                  <button
                    key={s}
                    onClick={() => { setTransitionStatus(s); setConfirmAction(false) }}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      transitionStatus === s
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'bg-muted border-border text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
              {transitionStatus === 'claimed' && (
                <Input
                  value={claimantName}
                  onChange={e => setClaimantName(e.target.value)}
                  placeholder="Claimant name (required)"
                  className="mb-2"
                />
              )}
              {transitionStatus === 'disposed' && (
                <Input
                  value={disposalReason}
                  onChange={e => setDisposalReason(e.target.value)}
                  placeholder="Disposal reason (required)"
                  className="mb-2"
                />
              )}
              {transitionStatus && !confirmAction && (
                <Button
                  onClick={() => setConfirmAction(true)}
                  disabled={
                    (transitionStatus === 'claimed'  && !claimantName.trim()) ||
                    (transitionStatus === 'disposed' && !disposalReason.trim())
                  }
                  className="w-full"
                >
                  Confirm — Mark as {transitionStatus.replace(/_/g, ' ')}
                </Button>
              )}
              {confirmAction && (
                <div className="flex gap-2">
                  <Button
                    onClick={handleTransition}
                    disabled={isPending}
                    variant="success"
                    className="flex-1"
                  >
                    {isPending ? 'Saving…' : 'Yes, confirm'}
                  </Button>
                  <Button
                    onClick={() => setConfirmAction(false)}
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="border-t border-border pt-4">
              <p className="text-muted-foreground text-sm mb-2">Status History</p>
              <div className="space-y-2">
                {history.map((h, i) => (
                  <div key={i} className="text-xs">
                    <span className="text-muted-foreground">{new Date(h.changed_at).toLocaleString('en-US', { hour12: false })}</span>
                    <span className="text-foreground mx-2">
                      {h.old_status ? `${h.old_status.replace(/_/g, ' ')} → ` : ''}{h.new_status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-muted-foreground">by {h.changer}</span>
                    {h.notes && <p className="text-muted-foreground mt-0.5">{h.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
