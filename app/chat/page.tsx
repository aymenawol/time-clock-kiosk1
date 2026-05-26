import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import ChatClient from './chat-client'

const CHAT_ROLES = ['admin', 'management', 'dispatcher', 'supervisor']

export default async function ChatPage() {
  const { user } = await getServerUser()
  if (!user) redirect('/')

  const role = (user.app_metadata?.role as string) ?? ''
  if (!CHAT_ROLES.includes(role)) redirect('/unauthorized')

  const supabase = await createSupabaseServerClient()

  // Get current employee
  const { data: emp } = await supabase
    .from('employees')
    .select('id, full_name')
    .eq('auth_user_id', user.id)
    .single()

  if (!emp) redirect('/unauthorized')

  // Get rooms this employee is a member of (or all department rooms for their scope)
  const { data: memberRooms } = await supabase
    .from('chat_room_members')
    .select('room_id, chat_rooms(id, name, type, department)')
    .eq('employee_id', emp.id)

  type RoomRow = { id: string; name: string; type: string; department?: string | null }
  const rooms: RoomRow[] = (memberRooms ?? [])
    .map((r: { chat_rooms: RoomRow | null }) => r.chat_rooms)
    .filter((r): r is RoomRow => r !== null)
    .sort((a, b) => {
      // Sort: emergency first, then department, then others
      const order: Record<string, number> = { emergency: 0, department: 1, group: 2, direct: 3 }
      return (order[a.type] ?? 9) - (order[b.type] ?? 9) || a.name.localeCompare(b.name)
    })

  // Load last 50 messages for each room with sender info
  const initialMessages: Record<string, {
    id: string
    content: string
    message_type: string
    requires_confirmation: boolean
    sent_at: string
    is_deleted: boolean
    sender_id: string
    sender_name: string
    confirmed_by: string[]
  }[]> = {}

  await Promise.all(rooms.map(async (room) => {
    const { data: msgs } = await supabase
      .from('chat_messages')
      .select(`
        id, content, message_type, requires_confirmation, sent_at, is_deleted, sender_id,
        employees!sender_id(full_name),
        chat_confirmations(confirmer_id)
      `)
      .eq('room_id', room.id)
      .order('sent_at', { ascending: true })
      .limit(50)

    type RawMsg = {
      id: string
      content: string
      message_type: string
      requires_confirmation: boolean
      sent_at: string
      is_deleted: boolean
      sender_id: string
      employees: { full_name: string } | null
      chat_confirmations: { confirmer_id: string }[]
    }

    initialMessages[room.id] = (msgs ?? []).map((m: RawMsg) => ({
      id:                    m.id,
      content:               m.content,
      message_type:          m.message_type,
      requires_confirmation: m.requires_confirmation,
      sent_at:               m.sent_at,
      is_deleted:            m.is_deleted,
      sender_id:             m.sender_id,
      sender_name:           m.employees?.full_name ?? 'Unknown',
      confirmed_by:          (m.chat_confirmations ?? []).map((c: { confirmer_id: string }) => c.confirmer_id),
    }))
  }))

  if (rooms.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">
        You have not been added to any chat rooms yet.
      </div>
    )
  }

  return (
    <ChatClient
      rooms={rooms}
      currentEmployeeId={emp.id}
      currentRole={role}
      initialMessages={initialMessages}
    />
  )
}
