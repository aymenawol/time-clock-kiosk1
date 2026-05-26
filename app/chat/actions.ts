'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getServerUser } from '@/lib/supabase-server'

const CHAT_ROLES = ['admin', 'management', 'dispatcher', 'supervisor']

async function assertChatRole() {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')
  const role = user.app_metadata?.role as string
  if (!CHAT_ROLES.includes(role)) throw new Error('No chat access')
  return { user, role }
}

export async function sendMessageAction(roomId: string, content: string, requiresConfirmation = false) {
  const { user } = await assertChatRole()
  const admin = createSupabaseAdmin()

  // Get sender employee id
  const { data: emp } = await admin.from('employees').select('id').eq('auth_user_id', user.id).single()
  if (!emp) return { error: 'Employee profile not found' }

  const { data: msg, error } = await admin.from('chat_messages').insert({
    room_id:               roomId,
    sender_id:             emp.id,
    content:               content.trim(),
    requires_confirmation: requiresConfirmation,
  }).select('id').single()

  if (error) return { error: error.message }
  revalidatePath('/chat')
  return { success: true, messageId: msg.id }
}

export async function markDeliveredAction(messageId: string, recipientId: string) {
  const admin = createSupabaseAdmin()
  await admin.from('chat_deliveries').upsert(
    { message_id: messageId, recipient_id: recipientId },
    { onConflict: 'message_id,recipient_id', ignoreDuplicates: true }
  )
}

export async function markReadAction(messageIds: string[], readerId: string) {
  if (!messageIds.length) return
  const admin = createSupabaseAdmin()
  const rows = messageIds.map(id => ({ message_id: id, reader_id: readerId }))
  await admin.from('chat_reads').upsert(rows, { onConflict: 'message_id,reader_id', ignoreDuplicates: true })
}

export async function confirmMessageAction(messageId: string) {
  const { user } = await assertChatRole()
  const admin = createSupabaseAdmin()

  const { data: emp } = await admin.from('employees').select('id').eq('auth_user_id', user.id).single()
  if (!emp) return { error: 'Employee not found' }

  const { error } = await admin.from('chat_confirmations').upsert(
    { message_id: messageId, confirmer_id: emp.id },
    { onConflict: 'message_id,confirmer_id', ignoreDuplicates: true }
  )
  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteMessageAction(messageId: string) {
  const { role } = await assertChatRole()
  if (role !== 'admin') return { error: 'Only admins can delete messages' }
  const admin = createSupabaseAdmin()
  const { error } = await admin.from('chat_messages')
    .update({ is_deleted: true, content: 'This message was removed' })
    .eq('id', messageId)
  if (error) return { error: error.message }
  revalidatePath('/chat')
  return { success: true }
}

export async function createRoomAction(name: string, type: 'direct' | 'group' | 'emergency', memberIds: string[]) {
  const { user, role } = await assertChatRole()
  if (!['admin', 'management'].includes(role)) return { error: 'Only admin/management can create rooms' }
  if (type === 'emergency' && role !== 'admin') return { error: 'Only admin can create emergency rooms' }

  const admin = createSupabaseAdmin()
  const { data: emp } = await admin.from('employees').select('id').eq('auth_user_id', user.id).single()
  if (!emp) return { error: 'Employee not found' }

  const { data: room, error } = await admin.from('chat_rooms').insert({
    name, type, created_by: emp.id,
  }).select('id').single()
  if (error) return { error: error.message }

  // Add creator + members
  const allMembers = [...new Set([emp.id, ...memberIds])]
  await admin.from('chat_room_members').insert(allMembers.map(id => ({ room_id: room.id, employee_id: id })))

  revalidatePath('/chat')
  return { success: true, roomId: room.id }
}

export async function getUnconfirmedCountAction(): Promise<number> {
  const { user } = await assertChatRole()
  const admin = createSupabaseAdmin()
  const { data: emp } = await admin.from('employees').select('id').eq('auth_user_id', user.id).single()
  if (!emp) return 0

  // Count messages requiring confirmation where this user hasn't confirmed
  const { count } = await admin
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('requires_confirmation', true)
    .eq('is_deleted', false)
    .not('id', 'in', `(SELECT message_id FROM chat_confirmations WHERE confirmer_id = '${emp.id}')`)

  return count ?? 0
}
