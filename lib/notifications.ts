/**
 * Server action helpers for the notification queue.
 * Enqueues in-app, SMS, and push events to notification_queue.
 * The Edge Function notification-processor polls this table every 30s.
 */
'use server'

import { createSupabaseAdmin } from './supabase-admin'

export type NotificationChannel = 'push' | 'sms' | 'in_app'

export interface NotificationPayload {
  recipientId: string
  eventType: string
  channels: NotificationChannel[]
  payload: Record<string, unknown>
}

export async function enqueueNotification(n: NotificationPayload): Promise<void> {
  const admin = createSupabaseAdmin()
  const rows = n.channels.map(channel => ({
    recipient_id: n.recipientId,
    event_type:   n.eventType,
    channel,
    payload:      n.payload,
  }))
  await admin.from('notification_queue').insert(rows)
}

export async function enqueueNotificationBatch(notifications: NotificationPayload[]): Promise<void> {
  const admin = createSupabaseAdmin()
  const rows = notifications.flatMap(n =>
    n.channels.map(channel => ({
      recipient_id: n.recipientId,
      event_type:   n.eventType,
      channel,
      payload:      n.payload,
    }))
  )
  if (rows.length > 0) await admin.from('notification_queue').insert(rows)
}
