-- V2 Phase 3: Safety Meetings
-- Date: 2026-05-25

-- ── Safety Meetings ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.safety_meetings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  -- Which employee group this meeting is for
  department     TEXT NOT NULL DEFAULT 'all'
                   CHECK (department IN ('drivers','coordinators','technicians','fueler_washer','all')),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  location       TEXT,
  notes          TEXT,
  status         TEXT NOT NULL DEFAULT 'scheduled'
                   CHECK (status IN ('scheduled','completed','cancelled')),
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Safety Meeting Sign-ins ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.safety_meeting_signins (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id        UUID NOT NULL REFERENCES public.safety_meetings(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  signed_in_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- present = signed in before meeting completed; late = after scheduled time but before complete
  attendance_status TEXT NOT NULL DEFAULT 'present'
                      CHECK (attendance_status IN ('present','late','absent','excused')),
  added_by_admin    BOOLEAN NOT NULL DEFAULT false, -- true = admin manually marked
  admin_note        TEXT,
  UNIQUE (meeting_id, employee_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_safety_meetings_date   ON public.safety_meetings(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_safety_meetings_dept   ON public.safety_meetings(department);
CREATE INDEX IF NOT EXISTS idx_safety_meetings_status ON public.safety_meetings(status);
CREATE INDEX IF NOT EXISTS idx_safety_signins_meeting ON public.safety_meeting_signins(meeting_id);
CREATE INDEX IF NOT EXISTS idx_safety_signins_emp     ON public.safety_meeting_signins(employee_id);

-- ── Triggers ──────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_safety_meetings_updated_at ON public.safety_meetings;
CREATE TRIGGER set_safety_meetings_updated_at
  BEFORE UPDATE ON public.safety_meetings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Realtime ──────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.safety_meeting_signins;
