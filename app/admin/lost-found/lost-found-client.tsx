'use client'

import { useState, useTransition } from 'react'
import { createBrowserClient } from '@supabase/ssr'
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

const STATUS_COLORS: Record<LostItemStatus, string> = {
  found:               'bg-blue-900 text-blue-200',
  collected:           'bg-yellow-900 text-yellow-200',
  returned_to_dispatch: 'bg-orange-900 text-orange-200',
  claimed:             'bg-green-900 text-green-200',
  disposed:            'bg-gray-800 text-gray-400',
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
    <div className="flex gap-6">
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
                  ? 'bg-white text-gray-900 border-white'
                  : 'bg-gray-900 text-gray-400 border-gray-700 hover:border-gray-500'
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
            <div className="text-gray-500 text-center py-12">No items</div>
          )}
          {filtered.map(item => (
            <button
              key={item.id}
              onClick={() => openItem(item)}
              className={`w-full text-left bg-gray-900 border rounded-xl p-4 hover:border-gray-600 transition-colors ${
                selected?.id === item.id ? 'border-blue-600' : 'border-gray-800'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{item.item_description}</p>
                  <p className="text-gray-500 text-xs mt-0.5">Bus {item.bus_number} · {item.location_found}</p>
                  <p className="text-gray-600 text-xs">{new Date(item.found_at).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${STATUS_COLORS[item.status]}`}>
                  {item.status.replace(/_/g, ' ')}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-96 shrink-0 bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5 max-h-[calc(100vh-160px)] overflow-y-auto">
          <div className="flex items-start justify-between">
            <h3 className="text-white font-semibold text-lg leading-tight">{selected.item_description}</h3>
            <button onClick={() => setSelected(null)} className="text-gray-600 hover:text-gray-300 text-xl leading-none">×</button>
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selected.status]}`}>
                {selected.status.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Bus</span>
              <span className="text-white">{selected.bus_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Location found</span>
              <span className="text-white">{selected.location_found}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Reported by</span>
              <span className="text-white">{selected.reporter_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Found at</span>
              <span className="text-white">{new Date(selected.found_at).toLocaleString('en-US', { hour12: false })}</span>
            </div>
            {selected.is_bag && (
              <div>
                <div className="text-gray-500 mb-0.5">Bag contents</div>
                <div className="text-yellow-200 bg-yellow-950/40 border border-yellow-800 rounded p-2 text-sm">
                  {selected.bag_contents}
                </div>
              </div>
            )}
          </div>

          {/* Photos */}
          {photoUrls.length > 0 && (
            <div>
              <p className="text-gray-500 text-xs mb-2">Photos</p>
              <div className="flex flex-wrap gap-2">
                {photoUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Status transitions */}
          {STATUS_TRANSITIONS[selected.status].length > 0 && (
            <div className="border-t border-gray-800 pt-4">
              <p className="text-gray-400 text-sm mb-2">Update Status</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {STATUS_TRANSITIONS[selected.status].map(s => (
                  <button
                    key={s}
                    onClick={() => { setTransitionStatus(s); setConfirmAction(false) }}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      transitionStatus === s
                        ? 'bg-blue-700 border-blue-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    {s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
              {transitionStatus === 'claimed' && (
                <input
                  value={claimantName}
                  onChange={e => setClaimantName(e.target.value)}
                  placeholder="Claimant name (required)"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm mb-2"
                />
              )}
              {transitionStatus === 'disposed' && (
                <input
                  value={disposalReason}
                  onChange={e => setDisposalReason(e.target.value)}
                  placeholder="Disposal reason (required)"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm mb-2"
                />
              )}
              {transitionStatus && !confirmAction && (
                <button
                  onClick={() => setConfirmAction(true)}
                  disabled={
                    (transitionStatus === 'claimed'  && !claimantName.trim()) ||
                    (transitionStatus === 'disposed' && !disposalReason.trim())
                  }
                  className="w-full bg-blue-700 hover:bg-blue-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                >
                  Confirm — Mark as {transitionStatus.replace(/_/g, ' ')}
                </button>
              )}
              {confirmAction && (
                <div className="flex gap-2">
                  <button
                    onClick={handleTransition}
                    disabled={isPending}
                    className="flex-1 bg-green-700 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-medium"
                  >
                    {isPending ? 'Saving…' : 'Yes, confirm'}
                  </button>
                  <button
                    onClick={() => setConfirmAction(false)}
                    className="text-gray-500 hover:text-gray-300 text-sm px-3"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="border-t border-gray-800 pt-4">
              <p className="text-gray-400 text-sm mb-2">Status History</p>
              <div className="space-y-2">
                {history.map((h, i) => (
                  <div key={i} className="text-xs">
                    <span className="text-gray-500">{new Date(h.changed_at).toLocaleString('en-US', { hour12: false })}</span>
                    <span className="text-gray-300 mx-2">
                      {h.old_status ? `${h.old_status.replace(/_/g, ' ')} → ` : ''}{h.new_status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-gray-600">by {h.changer}</span>
                    {h.notes && <p className="text-gray-500 mt-0.5">{h.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
