'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { sendMessageAction, markReadAction, markDeliveredAction, confirmMessageAction, deleteMessageAction } from './actions'
import { triggerEmergencyAction } from '@/app/admin/emergency/actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Check,
  CheckCheck,
  ShieldCheck,
  AlertTriangle,
  Send,
  Trash2,
  Menu,
  MessageSquare,
} from 'lucide-react'

interface Message {
  id: string
  content: string
  message_type: string
  requires_confirmation: boolean
  sent_at: string
  is_deleted: boolean
  sender_id: string
  sender_name: string
  confirmed_by: string[]  // confirmer IDs
  delivered_by: string[]  // recipient IDs that received it
  read_by: string[]       // reader IDs that opened it
}

// N10 — delivery status ladder for the sender's own messages.
function StatusLadder({ msg }: { msg: Message }) {
  const delivered = msg.delivered_by.length
  const read = msg.read_by.length
  const confirmed = msg.confirmed_by.length
  let label: string
  let cls: string
  let Icon: typeof Check
  if (msg.requires_confirmation && confirmed > 0) { label = `Confirmed (${confirmed})`; cls = 'text-ok'; Icon = ShieldCheck }
  else if (read > 0) { label = `Read (${read})`; cls = 'text-info'; Icon = CheckCheck }
  else if (delivered > 0) { label = `Delivered (${delivered})`; cls = 'text-muted-foreground'; Icon = CheckCheck }
  else { label = 'Sent'; cls = 'text-muted-foreground'; Icon = Check }
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${cls}`} title="Sent → Delivered → Read → Confirmed">
      <Icon className="size-3 shrink-0" aria-hidden />
      {label}
    </span>
  )
}

interface Room {
  id: string
  name: string
  type: string
}

interface Props {
  rooms: Room[]
  currentEmployeeId: string
  currentRole: string
  initialMessages: Record<string, Message[]>  // roomId → messages
}

export default function ChatClient({ rooms, currentEmployeeId, currentRole, initialMessages }: Props) {
  const [activeRoomId, setActiveRoomId]   = useState<string | null>(rooms[0]?.id ?? null)
  const [messages, setMessages]           = useState<Record<string, Message[]>>(initialMessages)
  const [draft, setDraft]                 = useState('')
  const [requireConfirm, setRequireConfirm] = useState(false)
  const [isPending, startTransition]      = useTransition()
  const [unconfirmedIds, setUnconfirmedIds] = useState<Set<string>>(new Set())
  const [emergencyError, setEmergencyError] = useState<string | null>(null)
  // Presentation-only: controls the mobile room-list drawer (no data impact).
  const [showRooms, setShowRooms] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const activeMessages = messages[activeRoomId ?? ''] ?? []
  const isAdmin        = currentRole === 'admin'
  const canManage      = ['admin', 'management'].includes(currentRole)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages.length])

  // Mark messages as delivered + read when room is open (others' messages only)
  useEffect(() => {
    if (!activeRoomId) return
    const others = activeMessages.filter(m => !m.is_deleted && m.sender_id !== currentEmployeeId)
    const ids = others.map(m => m.id)
    if (ids.length) {
      // Await + swallow: receipts are best-effort, but an unhandled rejection
      // here would surface as a console error / break fast-refresh in dev.
      void (async () => {
        try {
          await markReadAction(ids)
          await Promise.all(ids.map(id => markDeliveredAction(id)))
        } catch {
          /* receipt failures are non-fatal; next room-open retries */
        }
      })()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId, activeMessages.length])

  // Compute which messages this user hasn't confirmed
  useEffect(() => {
    const ids = new Set<string>()
    for (const msgs of Object.values(messages)) {
      for (const m of msgs) {
        if (m.requires_confirmation && !m.confirmed_by.includes(currentEmployeeId)) {
          ids.add(m.id)
        }
      }
    }
    setUnconfirmedIds(ids)
  }, [messages, currentEmployeeId])

  // Realtime subscription
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Receipt events (confirm/deliver/read) carry only a message_id. Locate the
    // single message, clone ONLY its room, and return `prev` untouched when there
    // is no change — was rebuilding every room's array per event (O(rooms×msgs)
    // churn + re-render of all rooms on every receipt).
    const applyReceipt = (
      messageId: string,
      field: 'confirmed_by' | 'delivered_by' | 'read_by',
      who: string
    ) => {
      setMessages(prev => {
        for (const roomId in prev) {
          const msgs = prev[roomId]
          const idx = msgs.findIndex(m => m.id === messageId)
          if (idx === -1) continue
          const m = msgs[idx]
          if (m[field].includes(who)) return prev // already recorded → no re-render
          const nextMsgs = msgs.slice()
          nextMsgs[idx] = { ...m, [field]: [...m[field], who] }
          return { ...prev, [roomId]: nextMsgs }
        }
        return prev // message not loaded on this client → no-op
      })
    }

    const ch = supabase
      .channel('chat-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, payload => {
        const m = payload.new as Omit<Message, 'sender_name' | 'confirmed_by'> & { room_id: string }
        setMessages(prev => ({
          ...prev,
          [m.room_id]: [
            ...(prev[m.room_id] ?? []),
            { ...m, sender_name: 'Loading…', confirmed_by: [], delivered_by: [], read_by: [] },
          ],
        }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, payload => {
        const m = payload.new as Omit<Message, 'sender_name' | 'confirmed_by'> & { room_id: string }
        setMessages(prev => ({
          ...prev,
          [m.room_id]: (prev[m.room_id] ?? []).map(msg =>
            msg.id === m.id ? { ...msg, content: m.content, is_deleted: m.is_deleted } : msg
          ),
        }))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_confirmations' }, payload => {
        const c = payload.new as { message_id: string; confirmer_id: string }
        applyReceipt(c.message_id, 'confirmed_by', c.confirmer_id)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_deliveries' }, payload => {
        const d = payload.new as { message_id: string; recipient_id: string }
        applyReceipt(d.message_id, 'delivered_by', d.recipient_id)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_reads' }, payload => {
        const r = payload.new as { message_id: string; reader_id: string }
        applyReceipt(r.message_id, 'read_by', r.reader_id)
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [])

  function handleSend() {
    if (!draft.trim() || !activeRoomId) return
    const content = draft
    setDraft('')
    startTransition(async () => {
      await sendMessageAction(activeRoomId, content, canManage && requireConfirm)
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // N10 — broadcast an emergency alert (admin only). Creates an active
  // emergency_event; drivers/operators acknowledge it from their dashboards.
  function handleSendEmergency() {
    setEmergencyError(null)
    const message = window.prompt('Emergency alert message to broadcast to all field staff:')
    if (!message?.trim()) return
    startTransition(async () => {
      const res = await triggerEmergencyAction('custom', message.trim())
      if (res?.error) setEmergencyError(res.error)
    })
  }

  const activeRoom = rooms.find(r => r.id === activeRoomId) ?? null

  return (
    <div className="flex h-[calc(100vh-56px)] bg-background relative">
      {/* Backdrop for the mobile room drawer */}
      {showRooms && (
        <div
          className="fixed inset-0 z-20 bg-foreground/40 md:hidden"
          onClick={() => setShowRooms(false)}
          aria-hidden
        />
      )}

      {/* Sidebar: room list. Off-canvas drawer on mobile, static column on md+. */}
      <div
        className={`absolute inset-y-0 left-0 z-30 w-64 max-w-[80vw] border-r border-border bg-card flex flex-col transition-transform md:static md:z-auto md:translate-x-0 md:bg-transparent ${
          showRooms ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-foreground font-semibold text-sm">Rooms</span>
          {unconfirmedIds.size > 0 && (
            <Badge variant="danger">{unconfirmedIds.size}</Badge>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {rooms.map(room => {
            const roomUnconfirmed = (messages[room.id] ?? []).filter(
              m => m.requires_confirmation && !m.confirmed_by.includes(currentEmployeeId)
            ).length
            const isActive = room.id === activeRoomId
            return (
              <button
                key={room.id}
                onClick={() => { setActiveRoomId(room.id); setShowRooms(false) }}
                className={`w-full text-left px-4 py-3 border-b border-border/50 transition-colors ${isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-sm truncate">{room.name}</span>
                  {roomUnconfirmed > 0 && (
                    <Badge variant="danger" className="shrink-0">{roomUnconfirmed}</Badge>
                  )}
                </div>
                <span className={`text-xs mt-1 inline-flex ${
                  room.type === 'emergency' ? 'text-danger' :
                  room.type === 'department' ? 'text-info' : 'text-muted-foreground'
                }`}>
                  {room.type}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Message area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header: toggle the room drawer + show active room name */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 md:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowRooms(true)}
            aria-label="Show rooms"
          >
            <Menu />
          </Button>
          <span className="text-sm font-semibold text-foreground truncate min-w-0">
            {activeRoom?.name ?? 'Chat'}
          </span>
        </div>

        {activeRoomId ? (
          <>
            {/* Message list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {activeMessages.map(msg => {
                const isOwn         = msg.sender_id === currentEmployeeId
                const needsConfirm  = msg.requires_confirmation && !msg.confirmed_by.includes(currentEmployeeId)
                const confirmedCount = msg.confirmed_by.length
                return (
                  <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] sm:max-w-md min-w-0 ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      {!isOwn && (
                        <span className="text-muted-foreground text-xs px-1 truncate max-w-full">{msg.sender_name}</span>
                      )}
                      <div className={`rounded-2xl px-4 py-2.5 ${
                        msg.is_deleted          ? 'bg-muted text-muted-foreground italic' :
                        msg.message_type === 'emergency_alert' ? 'bg-danger-surface text-danger border border-danger-border' :
                        isOwn                   ? 'bg-primary text-primary-foreground' :
                                                  'bg-muted text-foreground'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>

                      {/* Confirmation status */}
                      {msg.requires_confirmation && !msg.is_deleted && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground text-xs">{confirmedCount} confirmed</span>
                          {needsConfirm && (
                            <button
                              onClick={() => startTransition(() => { void confirmMessageAction(msg.id) })}
                              className="inline-flex items-center gap-1 text-xs border border-ok-border bg-ok-surface text-ok hover:bg-ok-surface/70 px-2 py-0.5 rounded-full"
                            >
                              <Check className="size-3 shrink-0" aria-hidden />
                              Confirm Read
                            </button>
                          )}
                          {!needsConfirm && (
                            <span className="inline-flex items-center gap-1 text-ok text-xs">
                              <ShieldCheck className="size-3 shrink-0" aria-hidden />
                              Confirmed
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground text-xs">
                          {new Date(msg.sent_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                        {isOwn && !msg.is_deleted && <StatusLadder msg={msg} />}
                        {isAdmin && !msg.is_deleted && (
                          <button
                            onClick={() => { if (confirm('Remove this message?')) startTransition(() => { void deleteMessageAction(msg.id) }) }}
                            className="inline-flex items-center gap-1 text-muted-foreground hover:text-danger text-xs"
                          >
                            <Trash2 className="size-3 shrink-0" aria-hidden />
                            remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-border p-3 sm:p-4">
              {isAdmin && (
                <div className="mb-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleSendEmergency}
                    disabled={isPending}
                  >
                    <AlertTriangle />
                    Send Emergency Alert
                  </Button>
                  {emergencyError && <p className="text-danger text-xs mt-1">{emergencyError}</p>}
                </div>
              )}
              {canManage && (
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="req-confirm"
                    checked={requireConfirm}
                    onChange={e => setRequireConfirm(e.target.checked)}
                    className="rounded border-input accent-primary"
                  />
                  <Label htmlFor="req-confirm" className="text-muted-foreground text-xs font-normal">
                    Require confirmation from all recipients
                  </Label>
                </div>
              )}
              <div className="flex items-end gap-2">
                <Textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                  rows={2}
                  className="flex-1 min-h-0 resize-none rounded-xl"
                />
                <Button
                  onClick={handleSend}
                  disabled={isPending || !draft.trim()}
                  className="rounded-xl"
                >
                  <Send />
                  <span className="hidden sm:inline">Send</span>
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <MessageSquare className="size-8" aria-hidden />
            Select a room to start chatting
          </div>
        )}
      </div>
    </div>
  )
}
