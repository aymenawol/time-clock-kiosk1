-- V2 Phase 10: GPS read-model rebuild (perf).
-- Date: 2026-06-01
--
-- Problem (audit): latest_bus_positions was a plain VIEW doing DISTINCT ON (bus_id)
-- over the unbounded append-only bus_positions heap (~1.2M rows/day at scale).
-- Every board/map load re-scanned the whole table.
--
-- Fix: a current_bus_positions table (one row per bus, PK bus_id) kept up to date
-- by an AFTER INSERT trigger on bus_positions. Reads become O(buses). The
-- latest_bus_positions view now reads from it, so application code is unchanged.

CREATE TABLE IF NOT EXISTS public.current_bus_positions (
  bus_id      UUID PRIMARY KEY REFERENCES public.buses(id) ON DELETE CASCADE,
  driver_id   UUID,
  shift_id    UUID,
  latitude    DOUBLE PRECISION,
  longitude   DOUBLE PRECISION,
  speed       DOUBLE PRECISION,
  heading     DOUBLE PRECISION,
  accuracy    DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.fn_upsert_current_position()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.bus_id IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.current_bus_positions
    (bus_id, driver_id, shift_id, latitude, longitude, speed, heading, accuracy, recorded_at)
  VALUES
    (NEW.bus_id, NEW.driver_id, NEW.shift_id, NEW.latitude, NEW.longitude,
     NEW.speed, NEW.heading, NEW.accuracy, COALESCE(NEW.recorded_at, now()))
  ON CONFLICT (bus_id) DO UPDATE SET
    driver_id   = EXCLUDED.driver_id,
    shift_id    = EXCLUDED.shift_id,
    latitude    = EXCLUDED.latitude,
    longitude   = EXCLUDED.longitude,
    speed       = EXCLUDED.speed,
    heading     = EXCLUDED.heading,
    accuracy    = EXCLUDED.accuracy,
    recorded_at = EXCLUDED.recorded_at
  WHERE EXCLUDED.recorded_at >= public.current_bus_positions.recorded_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS upsert_current_position ON public.bus_positions;
CREATE TRIGGER upsert_current_position
  AFTER INSERT ON public.bus_positions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_upsert_current_position();

-- Backfill current positions from existing history.
INSERT INTO public.current_bus_positions
  (bus_id, driver_id, shift_id, latitude, longitude, speed, heading, accuracy, recorded_at)
SELECT DISTINCT ON (bus_id)
  bus_id, driver_id, shift_id, latitude, longitude, speed, heading, accuracy, recorded_at
FROM public.bus_positions
WHERE bus_id IS NOT NULL
ORDER BY bus_id, recorded_at DESC
ON CONFLICT (bus_id) DO NOTHING;

-- Repoint the latest-position view at the O(buses) table (was DISTINCT ON over history).
DROP VIEW IF EXISTS public.latest_bus_positions;
CREATE VIEW public.latest_bus_positions AS
  SELECT bus_id, driver_id, shift_id, latitude, longitude, speed, heading, accuracy, recorded_at
  FROM public.current_bus_positions;

-- BRIN index on the append-only history → cheap time-range scans + retention drops.
CREATE INDEX IF NOT EXISTS idx_bus_positions_recorded_brin
  ON public.bus_positions USING brin (recorded_at);
