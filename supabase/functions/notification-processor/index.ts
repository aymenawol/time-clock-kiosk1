// Supabase Edge Function: notification-processor
// Runs on a schedule every 1 minute via pg_cron.
// Processes pending notification_queue rows — sends email via Resend, in-app via Realtime.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY   = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL       = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@timeclock.app'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

serve(async () => {
  try {
    // Fetch up to 50 pending/retry notifications
    const { data: queue, error } = await supabase
      .from('notification_queue')
      .select('*')
      .in('status', ['pending', 'retry'])
      .lte('retry_count', 2)
      .order('queued_at')
      .limit(50)

    if (error) throw error
    if (!queue?.length) return new Response('OK: empty', { status: 200 })

    const results = await Promise.allSettled(queue.map(processItem))

    const sent   = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    return new Response(JSON.stringify({ sent, failed }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('notification-processor error:', err)
    return new Response('ERROR', { status: 500 })
  }
})

async function processItem(item: Record<string, unknown>): Promise<void> {
  const channel = item.channel as string

  try {
    // email, push, and sms (fallback) all deliver via Resend email
    if (channel === 'email' || channel === 'push' || channel === 'sms') {
      await sendEmail(item)
    }
    // in_app notifications are delivered via Realtime — just mark as sent

    await supabase.from('notification_queue').update({
      status:       'sent',
      processed_at: new Date().toISOString(),
    }).eq('id', item.id)

    await supabase.from('notification_log').insert({
      recipient_id: item.recipient_id,
      event_type:   item.event_type,
      channel,
      payload:      item.payload,
      sent_at:      new Date().toISOString(),
    })
  } catch (err) {
    const retryCount = (item.retry_count as number) + 1
    const newStatus  = retryCount >= 2 ? 'failed' : 'retry'

    await supabase.from('notification_queue').update({
      status:       newStatus,
      retry_count:  retryCount,
      processed_at: new Date().toISOString(),
    }).eq('id', item.id)

    await supabase.from('notification_log').insert({
      recipient_id:   item.recipient_id,
      event_type:     item.event_type,
      channel,
      payload:        item.payload,
      failed:         true,
      failure_reason: String(err),
    })

    throw err
  }
}

async function sendEmail(item: Record<string, unknown>): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email notification')
    return
  }

  const { data: emp } = await supabase
    .from('employees')
    .select('email, name')
    .eq('id', item.recipient_id)
    .single()

  if (!emp?.email) return  // no email on file — silently skip

  const payload = item.payload as Record<string, unknown>
  const subject = payload.subject as string
    ?? payload.email_subject as string
    ?? `Time Clock: ${(item.event_type as string).replace(/_/g, ' ')}`
  const html = payload.email_html as string
    ?? payload.message as string
      ? `<p>${payload.message}</p>`
      : `<p>You have a new notification: <strong>${item.event_type}</strong></p>`

  const resp = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    FROM_EMAIL,
      to:      [emp.email],
      subject,
      html,
    }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Resend error ${resp.status}: ${text}`)
  }
}

