// Supabase Edge Function: chat-reminder
// Runs on schedule every 5 minutes.
// Sends reminders to users who have not confirmed required messages within 30 minutes.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

serve(async () => {
  try {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()

    // Find messages requiring confirmation sent > 30 min ago
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('id, room_id, sent_at')
      .eq('requires_confirmation', true)
      .eq('is_deleted', false)
      .lt('sent_at', cutoff)

    if (error) throw error
    if (!messages?.length) return new Response('OK: none', { status: 200 })

    let reminderCount = 0

    for (const msg of messages) {
      // Get room members who haven't confirmed
      const { data: members } = await supabase
        .from('chat_room_members')
        .select('employee_id')
        .eq('room_id', msg.room_id)

      if (!members?.length) continue

      const { data: confirmed } = await supabase
        .from('chat_confirmations')
        .select('confirmer_id')
        .eq('message_id', msg.id)

      const confirmedIds = new Set((confirmed ?? []).map((c: { confirmer_id: string }) => c.confirmer_id))
      const unconfirmed  = members.filter((m: { employee_id: string }) => !confirmedIds.has(m.employee_id))

      if (!unconfirmed.length) continue

      const reminders = unconfirmed.map((m: { employee_id: string }) => ({
        recipient_id: m.employee_id,
        event_type:   'chat_confirmation_reminder',
        channel:      'in_app',
        payload:      {
          message:    'You have an unconfirmed message requiring your acknowledgement',
          message_id: msg.id,
          room_id:    msg.room_id,
        },
      }))

      await supabase.from('notification_queue').insert(reminders)
      reminderCount += reminders.length
    }

    return new Response(JSON.stringify({ reminders_sent: reminderCount }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('chat-reminder error:', err)
    return new Response('ERROR', { status: 500 })
  }
})
