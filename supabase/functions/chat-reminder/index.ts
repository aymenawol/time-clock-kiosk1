// Supabase Edge Function: chat-reminder
// Runs on schedule every 5 minutes.
// Sends reminders to users who have not confirmed required messages within 30 minutes.
//
// N10 — BOUNDED: without limits this re-sent a reminder to every unconfirmed
// recipient on every 5-min tick (~288/day per message). We now (a) only consider
// messages from the last MAX_AGE_HOURS, (b) skip a recipient who already got a
// reminder within MIN_INTERVAL_MIN, and (c) cap total reminders per recipient
// per message at MAX_REMINDERS_PER_RECIPIENT.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const MIN_INTERVAL_MIN = 55                // at most ~one reminder/hour/recipient
const MAX_REMINDERS_PER_RECIPIENT = 3      // then stop nagging
const MAX_AGE_HOURS = 24                   // don't chase ancient unconfirmed messages

serve(async () => {
  try {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const ageFloor = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString()

    // Find messages requiring confirmation sent between MAX_AGE_HOURS ago and 30 min ago
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('id, room_id, sent_at')
      .eq('requires_confirmation', true)
      .eq('is_deleted', false)
      .lt('sent_at', cutoff)
      .gt('sent_at', ageFloor)

    if (error) throw error
    if (!messages?.length) return new Response('OK: none', { status: 200 })

    let reminderCount = 0
    const intervalFloor = new Date(Date.now() - MIN_INTERVAL_MIN * 60 * 1000).toISOString()

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
      let unconfirmed  = members.filter((m: { employee_id: string }) => !confirmedIds.has(m.employee_id))

      if (!unconfirmed.length) continue

      // Dedup against already-sent reminders for THIS message.
      const { data: priorReminders } = await supabase
        .from('notification_queue')
        .select('recipient_id, created_at')
        .eq('event_type', 'chat_confirmation_reminder')
        .eq('payload->>message_id', msg.id)

      const sentCount = new Map<string, number>()
      const lastSent  = new Map<string, string>()
      for (const r of (priorReminders ?? []) as { recipient_id: string; created_at: string }[]) {
        sentCount.set(r.recipient_id, (sentCount.get(r.recipient_id) ?? 0) + 1)
        const prev = lastSent.get(r.recipient_id)
        if (!prev || r.created_at > prev) lastSent.set(r.recipient_id, r.created_at)
      }

      unconfirmed = unconfirmed.filter((m: { employee_id: string }) => {
        if ((sentCount.get(m.employee_id) ?? 0) >= MAX_REMINDERS_PER_RECIPIENT) return false
        const last = lastSent.get(m.employee_id)
        if (last && last > intervalFloor) return false // reminded too recently
        return true
      })

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
