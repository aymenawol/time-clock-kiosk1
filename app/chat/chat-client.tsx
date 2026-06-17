'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { sendMessageAction, markReadAction, markDeliveredAction, confirmMessageAction, deleteMessageAction } from './actions'
import { triggerEmergencyAction } from '@/app/admin/emergency/actions'

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
  if (msg.requires_confirmation && confirmed > 0) { label = `✓✓ Confirmed (${confirmed})`; cls = 'text-green-400' }
  else if (read > 0) { label = `✓✓ Read (${read})`; cls = 'text-blue-400' }
  else if (delivered > 0) { label = `✓✓ Delivered (${delivered})`; cls = 'text-muted-foreground' }
  else { label = '✓ Sent'; cls = 'text-gray-600' }
  return <span className={`text-xs ${cls}`} title="Sent → Delivered → Read → Confirmed">{label}</span>
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
        setMessages(prev => {
          const next = { ...prev }
          for (const [roomId, msgs] of Object.entries(next)) {
            next[roomId] = msgs.map(m =>
              m.id === c.message_id && !m.confirmed_by.includes(c.confirmer_id)
                ? { ...m, confirmed_by: [...m.confirmed_by, c.confirmer_id] }
                : m
            )
          }
          return next
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_deliveries' }, payload => {
        const d = payload.new as { message_id: string; recipient_id: string }
        setMessages(prev => {
          const next = { ...prev }
          for (const [roomId, msgs] of Object.entries(next)) {
            next[roomId] = msgs.map(m =>
              m.id === d.message_id && !m.delivered_by.includes(d.recipient_id)
                ? { ...m, delivered_by: [...m.delivered_by, d.recipient_id] }
                : m
            )
          }
          return next
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_reads' }, payload => {
        const r = payload.new as { message_id: string; reader_id: string }
        setMessages(prev => {
          const next = { ...prev }
          for (const [roomId, msgs] of Object.entries(next)) {
            next[roomId] = msgs.map(m =>
              m.id === r.message_id && !m.read_by.includes(r.reader_id)
                ? { ...m, read_by: [...m.read_by, r.reader_id] }
                : m
            )
          }
          return next
        })
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

  return (
    <div className="flex h-[calc(100vh-56px)] bg-background">
      {/* Sidebar: room list */}
      <div className="w-64 border-r border-border flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-foreground font-semibold text-sm">Rooms</span>
          {unconfirmedIds.size > 0 && (
            <span className="bg-red-600 text-foreground text-xs font-bold px-2 py-0.5 rounded-full">
              {unconfirmedIds.size}
            </span>
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
                onClick={() => setActiveRoomId(room.id)}
                className={`w-full text-left px-4 py-3 border-b border-border/50 transition-colors ${isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-card hover:text-foreground'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm">{room.name}</span>
                  {roomUnconfirmed > 0 && (
                    <span className="bg-red-600 text-foreground text-xs font-bold px-1.5 py-0.5 rounded-full">
                      {roomUnconfirmed}
                    </span>
                  )}
                </div>
                <span className={`text-xs mt-0.5 block ${
                  room.type === 'emergency' ? 'text-red-400' :
                  room.type === 'department' ? 'text-blue-400' : 'text-gray-600'
                }`}>
                  {room.type}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Message area */}
      <div className="flex-1 flex flex-col">
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
                    <div className={`max-w-md ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      {!isOwn && (
                        <span className="text-muted-foreground text-xs px-1">{msg.sender_name}</span>
                      )}
                      <div className={`rounded-2xl px-4 py-2.5 ${
                        msg.is_deleted          ? 'bg-muted text-muted-foreground italic' :
                        msg.message_type === 'emergency_alert' ? 'bg-red-900 text-red-100 border border-red-700' :
                        isOwn                   ? 'bg-blue-700 text-foreground' :
                                                  'bg-muted text-foreground'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>

                      {/* Confirmation status */}
                      {msg.requires_confirmation && !msg.is_deleted && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 text-xs">{confirmedCount} confirmed</span>
                          {needsConfirm && (
                            <button
                              onClick={() => startTransition(() => { void confirmMessageAction(msg.id) })}
                              className="text-xs bg-green-800 hover:bg-green-700 text-foreground px-2 py-0.5 rounded-full"
                            >
                              Confirm Read
                            </button>
                          )}
                          {!needsConfirm && (
                            <span className="text-green-500 text-xs">✓ Confirmed</span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <span className="text-gray-600 text-xs">
                          {new Date(msg.sent_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                        {isOwn && !msg.is_deleted && <StatusLadder msg={msg} />}
                        {isAdmin && !msg.is_deleted && (
                          <button
                            onClick={() => { if (confirm('Remove this message?')) startTransition(() => { void deleteMessageAction(msg.id) }) }}
                            className="text-gray-700 hover:text-red-400 text-xs"
                          >
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
            <div className="border-t border-border p-4">
              {isAdmin && (
                <div className="mb-2">
                  <button
                    type="button"
                    onClick={handleSendEmergency}
                    disabled={isPending}
                    className="text-xs bg-red-700 hover:bg-red-600 text-foreground px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50"
                  >
                    🚨 Send Emergency Alert
                  </button>
                  {emergencyError && <p className="text-red-400 text-xs mt-1">{emergencyError}</p>}
                </div>
              )}
              {canManage && (
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="req-confirm"
                    checked={requireConfirm}
                    onChange={e => setRequireConfirm(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="req-confirm" className="text-muted-foreground text-xs cursor-pointer">
                    Require confirmation from all recipients
                  </label>
                </div>
              )}
              <div className="flex gap-2">
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                  rows={2}
                  className="flex-1 bg-muted border border-border rounded-xl px-4 py-2 text-foreground text-sm resize-none placeholder-gray-600 focus:outline-none focus:border-gray-500"
                />
                <button
                  onClick={handleSend}
                  disabled={isPending || !draft.trim()}
                  className="bg-blue-600 hover:bg-blue-500 text-foreground px-5 rounded-xl font-semibold text-sm disabled:opacity-40 transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-600">
            Select a room to start chatting
          </div>
        )}
      </div>
    </div>
  )
}
