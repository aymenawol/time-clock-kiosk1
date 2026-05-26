-- Phase 5: Notification System

CREATE TABLE IF NOT EXISTS notification_queue (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL,
  channel      TEXT NOT NULL CHECK (channel IN ('push','sms','in_app')),
  payload      JSONB NOT NULL DEFAULT '{}',
  queued_at    TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  retry_count  INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','sent','failed','retry'))
);

CREATE INDEX IF NOT EXISTS idx_notif_queue_pending ON notification_queue(queued_at)
  WHERE status IN ('pending','retry');

CREATE TABLE IF NOT EXISTS notification_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id   UUID REFERENCES employees(id) ON DELETE SET NULL,
  event_type     TEXT NOT NULL,
  channel        TEXT NOT NULL,
  payload        JSONB,
  sent_at        TIMESTAMPTZ DEFAULT now(),
  delivered_at   TIMESTAMPTZ,
  failed         BOOLEAN DEFAULT false,
  failure_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_notif_log_recipient  ON notification_log(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notif_log_event_type ON notification_log(event_type);
CREATE INDEX IF NOT EXISTS idx_notif_log_sent_at    ON notification_log(sent_at DESC);

CREATE TABLE IF NOT EXISTS email_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  subject      TEXT NOT NULL,
  body_html    TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Seed base templates
INSERT INTO email_templates (template_key, subject, body_html) VALUES
  ('overtime_awarded',      'Overtime Shift Awarded',          '<p>You have been awarded an overtime shift. Please check the app for details.</p>'),
  ('shift_bid_awarded',     'Shift Bid Result',                '<p>Your shift bid has been processed. Please log in to view your schedule.</p>'),
  ('form_approved',         'Form Approved',                   '<p>Your submitted form has been approved.</p>'),
  ('form_denied',           'Form Denied',                     '<p>Your submitted form has been denied. Please check the app for details.</p>'),
  ('safety_meeting_posted', 'New Safety Meeting Scheduled',    '<p>A new safety meeting has been posted. Please log in to view details.</p>'),
  ('payroll_biweekly',      'Biweekly Payroll Summary Ready',  '<p>Your biweekly payroll summary is ready. Please log in to review.</p>'),
  ('emergency_alert',       'EMERGENCY ALERT',                 '<p style="color:red;font-weight:bold;">An emergency alert has been issued. Please check the app immediately.</p>'),
  ('resignation_approved',  'Resignation Approved',            '<p>Your resignation has been approved and processed.</p>')
ON CONFLICT (template_key) DO NOTHING;

-- Enable Realtime for in-app notification delivery
ALTER PUBLICATION supabase_realtime ADD TABLE notification_queue;
