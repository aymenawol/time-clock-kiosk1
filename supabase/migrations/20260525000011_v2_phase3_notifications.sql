-- V2 Phase 3: In-App Notifications
-- Date: 2026-05-25

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  -- Type used for icon/color decisions on the frontend
  type        TEXT NOT NULL DEFAULT 'info'
                CHECK (type IN (
                  'info','overtime_shift','break_overdue','emergency_alert',
                  'form_approved','form_denied','form_returned','form_submitted',
                  'bid_awarded','shift_bid_open','safety_meeting',
                  'wheelchair_request','maintenance_reminder','resignation_approved',
                  'chat_message'
                )),
  title       TEXT NOT NULL,
  body        TEXT,
  -- Arbitrary payload for deep-link or action data
  data        JSONB NOT NULL DEFAULT '{}',
  -- Which channels have been dispatched (for audit; actual delivery is external)
  channels    TEXT[] NOT NULL DEFAULT ARRAY['in_app'],
  is_read     BOOLEAN NOT NULL DEFAULT false,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user     ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread   ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created  ON public.notifications(created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
