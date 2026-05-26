-- V2 Phase 2: Shifts (Digital Sign-In Sheet)
-- One shift record = one sign-in sheet entry per driver per day.
-- Date: 2026-05-25

CREATE TABLE IF NOT EXISTS public.shifts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  employee_id       UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  bus_id            UUID REFERENCES public.buses(id) ON DELETE SET NULL,
  tablet_id         UUID REFERENCES public.tablets(id) ON DELETE SET NULL,
  dispatcher_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  scheduled_start   TIME,
  scheduled_end     TIME,
  actual_start      TIMESTAMPTZ,
  actual_end        TIMESTAMPTZ,
  has_lunch         BOOLEAN NOT NULL DEFAULT true,
  lunch_waiver      BOOLEAN NOT NULL DEFAULT false,
  -- JSON string of signature pad data (base64 PNG or SVG paths)
  signature_data    TEXT,
  total_hours       NUMERIC(5,2),
  status            TEXT NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled','active','completed','cancelled')),
  -- Last radio code used by driver (10-8 / 10-39 / 10-37 / 10-7)
  radio_status      TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shifts_employee   ON public.shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_shifts_bus        ON public.shifts(bus_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date       ON public.shifts(date DESC);
CREATE INDEX IF NOT EXISTS idx_shifts_status     ON public.shifts(status);
CREATE INDEX IF NOT EXISTS idx_shifts_dispatcher ON public.shifts(dispatcher_id);

DROP TRIGGER IF EXISTS set_shifts_updated_at ON public.shifts;
CREATE TRIGGER set_shifts_updated_at
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Realtime so dispatcher dashboard refreshes live
ALTER PUBLICATION supabase_realtime ADD TABLE public.shifts;
