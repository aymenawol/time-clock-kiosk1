-- V2 Phase 2: Fleet / Bus Management
-- buses, tablets, bus_status_history
-- Date: 2026-05-25

-- ==================== TABLETS ====================

CREATE TABLE IF NOT EXISTS public.tablets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tablet_number TEXT NOT NULL,
  serial_number TEXT,
  is_available  BOOLEAN NOT NULL DEFAULT true,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tablets_number ON public.tablets(tablet_number);

-- ==================== BUSES ====================

CREATE TABLE IF NOT EXISTS public.buses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_number      TEXT NOT NULL,
  vin             TEXT,
  -- EV or Diesel
  bus_type        TEXT NOT NULL DEFAULT 'Diesel' CHECK (bus_type IN ('EV', 'Diesel')),
  -- Status: matches the UI color coding
  -- green: ready | blue: in_service | yellow: charging/fuel/wash/training
  -- red: maintenance_pmi/shopped_dvir/maintenance_repair | purple: safety_hold | gray: salvage
  status          TEXT NOT NULL DEFAULT 'ready' CHECK (status IN (
                    'ready', 'in_service', 'charging', 'fuel', 'wash',
                    'maintenance_pmi', 'shopped_dvir', 'maintenance_repair',
                    'safety_hold', 'salvage', 'training'
                  )),
  -- fuel_level: 0–100 (EV = battery %, Diesel = tank % approximation)
  fuel_level      NUMERIC(5,2) CHECK (fuel_level >= 0 AND fuel_level <= 100),
  current_mileage INTEGER,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_buses_number   ON public.buses(bus_number);
CREATE INDEX IF NOT EXISTS idx_buses_status           ON public.buses(status);
CREATE INDEX IF NOT EXISTS idx_buses_is_active        ON public.buses(is_active);

-- ==================== BUS STATUS HISTORY ====================

CREATE TABLE IF NOT EXISTS public.bus_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id      UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  changed_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason      TEXT,
  fuel_level  NUMERIC(5,2),
  mileage     INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bus_history_bus_id    ON public.bus_status_history(bus_id);
CREATE INDEX IF NOT EXISTS idx_bus_history_created   ON public.bus_status_history(created_at DESC);

-- ==================== TRIGGERS: updated_at ====================

-- handle_updated_at already exists from Phase 1 (CREATE OR REPLACE is safe)

DROP TRIGGER IF EXISTS set_buses_updated_at   ON public.buses;
CREATE TRIGGER set_buses_updated_at
  BEFORE UPDATE ON public.buses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_tablets_updated_at ON public.tablets;
CREATE TRIGGER set_tablets_updated_at
  BEFORE UPDATE ON public.tablets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==================== TRIGGER: auto-log status changes ====================

CREATE OR REPLACE FUNCTION public.log_bus_status_change()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.bus_status_history
      (bus_id, from_status, to_status, fuel_level, mileage)
    VALUES
      (NEW.id, OLD.status, NEW.status, NEW.fuel_level, NEW.current_mileage);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bus_status_change ON public.buses;
CREATE TRIGGER trg_bus_status_change
  AFTER UPDATE OF status ON public.buses
  FOR EACH ROW EXECUTE FUNCTION public.log_bus_status_change();

-- ==================== REALTIME ====================

ALTER PUBLICATION supabase_realtime ADD TABLE public.buses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bus_status_history;
