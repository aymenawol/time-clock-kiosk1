-- V2 Phase 3: Overtime Shifts & Off-Day Requests
-- Date: 2026-05-25

-- ── Overtime Shifts ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.overtime_shifts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL,
  start_time      TIME NOT NULL,
  duration_hours  NUMERIC(4,2) NOT NULL,
  slots_available INTEGER NOT NULL DEFAULT 1,
  description     TEXT,
  posted_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  bid_close_at    TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','closed','awarded','cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Overtime Bids ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.overtime_bids (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  overtime_shift_id UUID NOT NULL REFERENCES public.overtime_shifts(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (overtime_shift_id, employee_id)
);

-- ── Overtime Awards ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.overtime_awards (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  overtime_shift_id UUID NOT NULL REFERENCES public.overtime_shifts(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  award_method      TEXT NOT NULL DEFAULT 'seniority'
                      CHECK (award_method IN ('seniority','manual')),
  awarded_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  awarded_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notified          BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (overtime_shift_id, employee_id)
);

-- ── Off-Day Work Requests ─────────────────────────────────────────────────────
-- Dispatcher sends targeted work requests to employees on their off day.

CREATE TABLE IF NOT EXISTS public.off_day_requests (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id          UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  requested_date       DATE NOT NULL,
  posted_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message              TEXT,
  response             TEXT DEFAULT 'pending'
                         CHECK (response IN ('pending','accepted','declined','custom')),
  available_start_time TIME,
  available_hours      NUMERIC(4,2),
  custom_availability  TEXT,
  responded_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── OT Availability Banner ────────────────────────────────────────────────────
-- Dispatcher-controlled banner shown at top of driver view.

CREATE TABLE IF NOT EXISTS public.ot_banner (
  id         TEXT PRIMARY KEY DEFAULT 'singleton',
  is_active  BOOLEAN NOT NULL DEFAULT false,
  message    TEXT NOT NULL DEFAULT 'Today, if you are available to work up to 10 hours, we would greatly appreciate it.',
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.ot_banner (id) VALUES ('singleton') ON CONFLICT (id) DO NOTHING;

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ot_shifts_date       ON public.overtime_shifts(date);
CREATE INDEX IF NOT EXISTS idx_ot_shifts_status     ON public.overtime_shifts(status);
CREATE INDEX IF NOT EXISTS idx_ot_bids_shift        ON public.overtime_bids(overtime_shift_id);
CREATE INDEX IF NOT EXISTS idx_ot_bids_emp          ON public.overtime_bids(employee_id);
CREATE INDEX IF NOT EXISTS idx_ot_awards_shift      ON public.overtime_awards(overtime_shift_id);
CREATE INDEX IF NOT EXISTS idx_off_day_emp          ON public.off_day_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_off_day_date         ON public.off_day_requests(requested_date);
CREATE INDEX IF NOT EXISTS idx_off_day_pending      ON public.off_day_requests(response) WHERE response = 'pending';

-- ── Triggers ──────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_ot_shifts_updated_at ON public.overtime_shifts;
CREATE TRIGGER set_ot_shifts_updated_at
  BEFORE UPDATE ON public.overtime_shifts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
