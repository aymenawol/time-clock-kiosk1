-- V2 Phase 2: Passenger Counting Sheets
-- Date: 2026-05-25

CREATE TABLE IF NOT EXISTS public.counting_sheets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id     UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  driver_id    UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  bus_id       UUID REFERENCES public.buses(id) ON DELETE SET NULL,
  start_time   TIMESTAMPTZ,
  end_time     TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted')),
  submitted_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shift_id)
);

CREATE TABLE IF NOT EXISTS public.counting_rows (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id       UUID NOT NULL REFERENCES public.counting_sheets(id) ON DELETE CASCADE,
  row_order      SMALLINT NOT NULL,
  departure_time TIME,
  rac            SMALLINT NOT NULL DEFAULT 0,
  t1             SMALLINT NOT NULL DEFAULT 0,
  t3             SMALLINT NOT NULL DEFAULT 0,
  term1          SMALLINT NOT NULL DEFAULT 0,
  term3_west     SMALLINT NOT NULL DEFAULT 0,
  term3_east     SMALLINT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_counting_sheets_shift    ON public.counting_sheets(shift_id);
CREATE INDEX IF NOT EXISTS idx_counting_sheets_driver   ON public.counting_sheets(driver_id);
CREATE INDEX IF NOT EXISTS idx_counting_rows_sheet      ON public.counting_rows(sheet_id);
CREATE INDEX IF NOT EXISTS idx_counting_rows_order      ON public.counting_rows(sheet_id, row_order);

DROP TRIGGER IF EXISTS set_counting_sheets_updated_at ON public.counting_sheets;
CREATE TRIGGER set_counting_sheets_updated_at
  BEFORE UPDATE ON public.counting_sheets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_counting_rows_updated_at ON public.counting_rows;
CREATE TRIGGER set_counting_rows_updated_at
  BEFORE UPDATE ON public.counting_rows
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
