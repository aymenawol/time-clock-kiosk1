-- V2 Phase 3: Shift Bid System
-- Date: 2026-05-25

-- ── Bid Cycles ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shift_bid_cycles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  description         TEXT,
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  submission_open_at  TIMESTAMPTZ,
  submission_close_at TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','published','locked','awarded')),
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  awarded_at          TIMESTAMPTZ,
  awarded_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Bid Slots (per cycle) ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shift_bid_slots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id     UUID NOT NULL REFERENCES public.shift_bid_cycles(id) ON DELETE CASCADE,
  bid_number   INTEGER NOT NULL,
  shift_start  TIME NOT NULL,
  shift_end    TIME NOT NULL,
  report_time  TIME NOT NULL,
  -- Days of week: Sun=0 … Sat=6
  days_sun     BOOLEAN NOT NULL DEFAULT false,
  days_mon     BOOLEAN NOT NULL DEFAULT false,
  days_tue     BOOLEAN NOT NULL DEFAULT false,
  days_wed     BOOLEAN NOT NULL DEFAULT false,
  days_thu     BOOLEAN NOT NULL DEFAULT false,
  days_fri     BOOLEAN NOT NULL DEFAULT false,
  days_sat     BOOLEAN NOT NULL DEFAULT false,
  route_type   TEXT NOT NULL DEFAULT 'full_time'
                 CHECK (route_type IN ('full_time','employee_shuttle','part_time')),
  max_drivers  INTEGER NOT NULL DEFAULT 1,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, bid_number)
);

-- ── Submissions (driver preferences) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shift_bid_submissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id     UUID NOT NULL REFERENCES public.shift_bid_cycles(id) ON DELETE CASCADE,
  employee_id  UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  -- JSONB array: [{slot_id: UUID, rank: 1|2|3}]
  preferences  JSONB NOT NULL DEFAULT '[]',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, employee_id)
);

-- ── Awards (seniority-ordered results) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shift_bid_awards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id         UUID NOT NULL REFERENCES public.shift_bid_cycles(id) ON DELETE CASCADE,
  employee_id      UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  slot_id          UUID NOT NULL REFERENCES public.shift_bid_slots(id) ON DELETE CASCADE,
  -- which preference rank was filled (NULL = auto-assigned / unsubmitted)
  preference_rank  INTEGER CHECK (preference_rank BETWEEN 1 AND 3),
  award_method     TEXT NOT NULL DEFAULT 'seniority'
                     CHECK (award_method IN ('seniority','manual','auto_unsubmitted')),
  override_reason  TEXT,
  awarded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  awarded_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notification_sent BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (cycle_id, employee_id)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_bid_cycles_status      ON public.shift_bid_cycles(status);
CREATE INDEX IF NOT EXISTS idx_bid_slots_cycle        ON public.shift_bid_slots(cycle_id);
CREATE INDEX IF NOT EXISTS idx_bid_submissions_cycle  ON public.shift_bid_submissions(cycle_id);
CREATE INDEX IF NOT EXISTS idx_bid_submissions_emp    ON public.shift_bid_submissions(employee_id);
CREATE INDEX IF NOT EXISTS idx_bid_awards_cycle       ON public.shift_bid_awards(cycle_id);
CREATE INDEX IF NOT EXISTS idx_bid_awards_emp         ON public.shift_bid_awards(employee_id);

-- ── Triggers ─────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_bid_cycles_updated_at ON public.shift_bid_cycles;
CREATE TRIGGER set_bid_cycles_updated_at
  BEFORE UPDATE ON public.shift_bid_cycles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_bid_submissions_updated_at ON public.shift_bid_submissions;
CREATE TRIGGER set_bid_submissions_updated_at
  BEFORE UPDATE ON public.shift_bid_submissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
