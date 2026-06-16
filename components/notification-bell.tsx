'use client'

import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Bell } from 'lucide-react'

interface Notif {
  id: string
  type: string
  title: string
  body: string | null
  is_read: boolean
  created_at: string
}

// Semantic dot color per notification type (green=ok, red=problem, amber=warn, purple=hazard).
const TYPE_DOT: Record<string, string> = {
  emergency_alert:     'bg-purple-500',
  break_overdue:       'bg-red-500',
  form_denied:         'bg-red-500',
  form_approved:       'bg-green-500',
  resignation_approved:'bg-green-500',
  wheelchair_request:  'bg-orange-500',
  overtime_shift:      'bg-blue-500',
  bid_awarded:         'bg-blue-500',
  shift_bid_open:      'bg-blue-500',
  safety_meeting:      'bg-amber-500',
  maintenance_reminder:'bg-amber-500',
}

export default function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([])
  const [open, setOpen] = useState(false)
  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(null)

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabaseRef.current = supabase
    let channel: ReturnType<typeof supabase.channel> | null = null

    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('notifications')
        .select('id, type, title, body, is_read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setItems((data ?? []) as Notif[])

      channel = supabase
        .channel('notif-bell')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => setItems(prev => [payload.new as Notif, ...prev].slice(0, 20))
        )
        .subscribe()
    })()

    return () => { if (channel) supabase.removeChannel(channel) }
  }, [])

  const unread = items.filter(n => !n.is_read).length

  async function markAllRead() {
    const supabase = supabaseRef.current
    if (!supabase) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setItems(prev => prev.map(n => ({ ...n, is_read: true })))
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_read', false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => { const next = !open; setOpen(next); if (next && unread) markAllRead() }}
        className="relative p-1.5 rounded-lg hover:bg-muted text-foreground"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-600 text-foreground text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-card border border-border rounded-xl shadow-2xl z-50">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between sticky top-0 bg-card">
              <span className="text-sm font-semibold text-foreground">Notifications</span>
            </div>
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-gray-600">No notifications</p>
            ) : items.map(n => (
              <div key={n.id} className={`px-3 py-2 border-b border-border/50 ${n.is_read ? '' : 'bg-muted/40'}`}>
                <div className="flex items-start gap-2">
                  <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${TYPE_DOT[n.type] ?? 'bg-gray-500'}`} />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground font-medium">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5 break-words">{n.body}</p>}
                    <p className="text-[10px] text-gray-600 mt-0.5">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
