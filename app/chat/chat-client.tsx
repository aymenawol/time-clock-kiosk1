'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { sendMessageAction, markReadAction, confirmMessageAction, deleteMessageAction } from './actions'

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
  const bottomRef = useRef<HTMLDivElement>(null)

  const activeMessages = messages[activeRoomId ?? ''] ?? []
  const isAdmin        = currentRole === 'admin'
  const canManage      = ['admin', 'management'].includes(currentRole)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages.length])

  // Mark messages as read when room is open
  useEffect(() => {
    if (!activeRoomId) return
    const unread = activeMessages.filter(m => !m.is_deleted).map(m => m.id)
    if (unread.length) markReadAction(unread, currentEmployeeId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId])

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
            { ...m, sender_name: 'Loading…', confirmed_by: [] },
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
              m.id === c.message_id
                ? { ...m, confirmed_by: [...m.confirmed_by, c.confirmer_id] }
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

  return (
    <div className="flex h-[calc(100vh-56px)] bg-gray-950">
      {/* Sidebar: room list */}
      <div className="w-64 border-r border-gray-800 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <span className="text-white font-semibold text-sm">Rooms</span>
          {unconfirmedIds.size > 0 && (
            <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
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
                className={`w-full text-left px-4 py-3 border-b border-gray-800/50 transition-colors ${isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-900 hover:text-white'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm">{room.name}</span>
                  {roomUnconfirmed > 0 && (
                    <span className="bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
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
                        <span className="text-gray-500 text-xs px-1">{msg.sender_name}</span>
                      )}
                      <div className={`rounded-2xl px-4 py-2.5 ${
                        msg.is_deleted          ? 'bg-gray-800 text-gray-500 italic' :
                        msg.message_type === 'emergency_alert' ? 'bg-red-900 text-red-100 border border-red-700' :
                        isOwn                   ? 'bg-blue-700 text-white' :
                                                  'bg-gray-800 text-white'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>

                      {/* Confirmation status */}
                      {msg.requires_confirmation && !msg.is_deleted && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 text-xs">{confirmedCount} confirmed</span>
                          {needsConfirm && (
                            <button
                              onClick={() => startTransition(() => confirmMessageAction(msg.id))}
                              className="text-xs bg-green-800 hover:bg-green-700 text-white px-2 py-0.5 rounded-full"
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
                        {isAdmin && !msg.is_deleted && (
                          <button
                            onClick={() => { if (confirm('Remove this message?')) startTransition(() => deleteMessageAction(msg.id)) }}
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
            <div className="border-t border-gray-800 p-4">
              {canManage && (
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="req-confirm"
                    checked={requireConfirm}
                    onChange={e => setRequireConfirm(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="req-confirm" className="text-gray-400 text-xs cursor-pointer">
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
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white text-sm resize-none placeholder-gray-600 focus:outline-none focus:border-gray-500"
                />
                <button
                  onClick={handleSend}
                  disabled={isPending || !draft.trim()}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 rounded-xl font-semibold text-sm disabled:opacity-40 transition-colors"
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
