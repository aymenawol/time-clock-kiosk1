// Supabase Edge Function: notification-processor
// Runs on a schedule every 30 seconds via pg_cron or Supabase cron.
// Processes pending notification_queue rows — sends SMS via Twilio, email via Resend.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TWILIO_SID       = Deno.env.get('TWILIO_ACCOUNT_SID')
const TWILIO_TOKEN     = Deno.env.get('TWILIO_AUTH_TOKEN')
const TWILIO_FROM      = Deno.env.get('TWILIO_FROM_NUMBER')
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
    if (channel === 'sms') await sendSMS(item)
    else if (channel === 'push') await sendPush(item)
    // in_app notifications are delivered via Realtime — just mark as sent

    // Mark sent + log
    await supabase.from('notification_queue').update({ status: 'sent', processed_at: new Date().toISOString() }).eq('id', item.id)
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
      status:      newStatus,
      retry_count: retryCount,
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

    if (newStatus === 'failed') {
      // Alert admin of permanent failure
      console.error(`Notification permanently failed for ${item.id}: ${err}`)
    }

    throw err
  }
}

async function sendSMS(item: Record<string, unknown>): Promise<void> {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    throw new Error('Twilio credentials not configured')
  }

  // Look up recipient phone
  const { data: emp } = await supabase
    .from('employees')
    .select('phone')
    .eq('id', item.recipient_id)
    .single()

  if (!emp?.phone) throw new Error('Recipient has no phone number')

  const payload = item.payload as Record<string, unknown>
  const body    = payload.sms_body as string ?? payload.message as string ?? `Time Clock alert: ${item.event_type}`

  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: emp.phone, From: TWILIO_FROM, Body: body }),
    }
  )

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Twilio error ${resp.status}: ${text}`)
  }
}

async function sendPush(item: Record<string, unknown>): Promise<void> {
  // Push notifications via Web Push API or Resend — use email as push fallback
  if (!RESEND_API_KEY) return  // silently skip if not configured

  const { data: emp } = await supabase
    .from('employees')
    .select('email')
    .eq('id', item.recipient_id)
    .single()

  if (!emp?.email) return

  const payload = item.payload as Record<string, unknown>
  const subject = payload.subject as string ?? `Time Clock: ${item.event_type}`
  const html    = payload.email_html as string ?? `<p>${payload.message ?? item.event_type}</p>`

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [emp.email], subject, html }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Resend error ${resp.status}: ${text}`)
  }
}
