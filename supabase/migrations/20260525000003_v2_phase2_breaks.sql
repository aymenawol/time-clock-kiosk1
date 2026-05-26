-- V2 Phase 2: Break Tracking
-- Date: 2026-05-25

CREATE TABLE IF NOT EXISTS public.breaks (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id                UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  employee_id             UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  break_number            SMALLINT NOT NULL CHECK (break_number IN (1, 2)),
  -- When this break is scheduled to start (calculated from shift actual_start)
  scheduled_start         TIMESTAMPTZ,
  -- The window during which the driver may press START BREAK
  window_open             TIMESTAMPTZ,
  -- If not started by window_close → status = 'missed'
  window_close            TIMESTAMPTZ,
  actual_start            TIMESTAMPTZ,
  actual_end              TIMESTAMPTZ,
  duration_minutes        SMALLINT NOT NULL DEFAULT 15,
  status                  TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','active','completed','missed','overrun')),
  -- Alerts
  sms_reminder_sent       BOOLEAN NOT NULL DEFAULT false,   -- at 17 min
  overrun_alert_sent      BOOLEAN NOT NULL DEFAULT false,   -- at 20 min
  -- Dispatcher re-enable (if missed and override granted)
  dispatcher_override_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dispatcher_override_at  TIMESTAMPTZ,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shift_id, break_number)
);

CREATE INDEX IF NOT EXISTS idx_breaks_shift_id    ON public.breaks(shift_id);
CREATE INDEX IF NOT EXISTS idx_breaks_employee_id ON public.breaks(employee_id);
CREATE INDEX IF NOT EXISTS idx_breaks_status      ON public.breaks(status);

DROP TRIGGER IF EXISTS set_breaks_updated_at ON public.breaks;
CREATE TRIGGER set_breaks_updated_at
  BEFORE UPDATE ON public.breaks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Realtime for dispatcher break alert panel
ALTER PUBLICATION supabase_realtime ADD TABLE public.breaks;
