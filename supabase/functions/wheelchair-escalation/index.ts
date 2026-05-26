// Supabase Edge Function: wheelchair-escalation
// Runs on schedule every 60 seconds.
// Escalates pending wheelchair_requests older than 5 minutes with no response.
// Also notifies management of escalations.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

serve(async () => {
  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    // Find pending requests with no response older than 5 min
    const { data: stale, error } = await supabase
      .from('wheelchair_requests')
      .select('id, driver_id, bus_id, passenger_name')
      .eq('status', 'pending')
      .is('responded_at', null)
      .lt('submitted_at', cutoff)

    if (error) throw error
    if (!stale?.length) return new Response('OK: none', { status: 200 })

    const now = new Date().toISOString()

    // Update to escalated
    const ids = stale.map((r: { id: string }) => r.id)
    await supabase
      .from('wheelchair_requests')
      .update({ status: 'escalated', escalated_at: now })
      .in('id', ids)

    // Notify drivers: "No dispatcher response — please call dispatch directly"
    const driverNotifs = stale.map((r: { id: string; driver_id: string }) => ({
      recipient_id: r.driver_id,
      event_type:   'wheelchair_no_response',
      channel:      'in_app',
      payload:      {
        message:              'No dispatcher response — please call dispatch directly',
        wheelchair_request_id: r.id,
      },
    }))

    // Notify management
    const { data: mgmt } = await supabase
      .from('employees')
      .select('id')
      .in('role', ['admin', 'management'])

    const mgmtNotifs = (mgmt ?? []).flatMap((e: { id: string }) =>
      stale.map((r: { id: string }) => ({
        recipient_id: e.id,
        event_type:   'wheelchair_escalated',
        channel:      'in_app',
        payload:      { wheelchair_request_id: r.id, message: '10-51 escalated: no dispatcher response in 5 minutes' },
      }))
    )

    const allNotifs = [...driverNotifs, ...mgmtNotifs]
    if (allNotifs.length > 0) {
      await supabase.from('notification_queue').insert(allNotifs)
    }

    return new Response(JSON.stringify({ escalated: stale.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('wheelchair-escalation error:', err)
    return new Response('ERROR', { status: 500 })
  }
})
