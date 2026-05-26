-- V2 Phase 2: Vehicle Inspections & Repair Notes
-- Date: 2026-05-25

-- ==================== VEHICLE INSPECTIONS ====================

CREATE TABLE IF NOT EXISTS public.vehicle_inspections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id          UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  inspection_type   TEXT NOT NULL CHECK (inspection_type IN ('pre_trip', 'post_trip')),
  bus_id            UUID REFERENCES public.buses(id) ON DELETE SET NULL,
  driver_id         UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  inspection_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time        TIME,
  end_time          TIME,
  beginning_mileage INTEGER,
  ending_mileage    INTEGER,
  miles_driven      INTEGER,   -- set in app: ending_mileage - beginning_mileage
  time_worked       TEXT,
  -- JSONB array of SVG path commands drawn by driver on the bus diagram
  -- e.g. [{"tool":"pen","color":"#e11","paths":[{"d":"M10,10 L20,20"}]}]
  damage_drawing    JSONB NOT NULL DEFAULT '[]'::JSONB,
  has_defects       BOOLEAN NOT NULL DEFAULT false,
  -- Once submitted, locked to read-only for drivers
  is_locked         BOOLEAN NOT NULL DEFAULT false,
  submitted_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shift_id, inspection_type)
);

-- ==================== INSPECTION ITEMS (checklist rows) ====================

CREATE TABLE IF NOT EXISTS public.inspection_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES public.vehicle_inspections(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  item_name     TEXT NOT NULL,
  -- NULL = not yet checked, TRUE = OK, FALSE = defect
  is_ok         BOOLEAN,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==================== REPAIR NOTES ====================

CREATE TABLE IF NOT EXISTS public.repair_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id          UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  inspection_id   UUID REFERENCES public.vehicle_inspections(id) ON DELETE SET NULL,
  technician_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  defect_category TEXT,
  defect_item     TEXT,
  notes           TEXT NOT NULL DEFAULT '',
  -- Array of storage URLs for repair photos
  photo_urls      TEXT[] NOT NULL DEFAULT '{}',
  is_resolved     BOOLEAN NOT NULL DEFAULT false,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_inspections_shift   ON public.vehicle_inspections(shift_id);
CREATE INDEX IF NOT EXISTS idx_inspections_bus     ON public.vehicle_inspections(bus_id);
CREATE INDEX IF NOT EXISTS idx_inspections_driver  ON public.vehicle_inspections(driver_id);
CREATE INDEX IF NOT EXISTS idx_inspection_items_id ON public.inspection_items(inspection_id);
CREATE INDEX IF NOT EXISTS idx_repair_notes_bus    ON public.repair_notes(bus_id);
CREATE INDEX IF NOT EXISTS idx_repair_notes_open   ON public.repair_notes(is_resolved) WHERE is_resolved = false;

-- ==================== TRIGGERS ====================

DROP TRIGGER IF EXISTS set_vehicle_inspections_updated_at ON public.vehicle_inspections;
CREATE TRIGGER set_vehicle_inspections_updated_at
  BEFORE UPDATE ON public.vehicle_inspections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_repair_notes_updated_at ON public.repair_notes;
CREATE TRIGGER set_repair_notes_updated_at
  BEFORE UPDATE ON public.repair_notes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- When a repair note is marked resolved, update the timestamp automatically
CREATE OR REPLACE FUNCTION public.handle_repair_resolved()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.is_resolved = false AND NEW.is_resolved = true THEN
    NEW.resolved_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_repair_resolved ON public.repair_notes;
CREATE TRIGGER trg_repair_resolved
  BEFORE UPDATE OF is_resolved ON public.repair_notes
  FOR EACH ROW EXECUTE FUNCTION public.handle_repair_resolved();

-- ==================== REALTIME ====================

ALTER PUBLICATION supabase_realtime ADD TABLE public.repair_notes;
