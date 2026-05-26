-- Phase 4: GPS Tracking Infrastructure
-- bus_positions: live GPS updates from driver tablets
CREATE TABLE IF NOT EXISTS bus_positions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id        UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  driver_id     UUID REFERENCES employees(id) ON DELETE SET NULL,
  shift_id      UUID REFERENCES shifts(id) ON DELETE SET NULL,
  latitude      DECIMAL(10,7) NOT NULL,
  longitude     DECIMAL(11,7) NOT NULL,
  speed         DECIMAL(6,2),       -- km/h
  heading       DECIMAL(5,2),       -- degrees 0-360
  accuracy      DECIMAL(8,2),       -- metres
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bus_positions_bus_recorded  ON bus_positions(bus_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_bus_positions_recorded_at   ON bus_positions(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_bus_positions_shift         ON bus_positions(shift_id) WHERE shift_id IS NOT NULL;

-- Materialised "latest position per bus" view
CREATE OR REPLACE VIEW latest_bus_positions AS
  SELECT DISTINCT ON (bus_id) *
  FROM bus_positions
  ORDER BY bus_id, recorded_at DESC;

-- Cleanup function: delete positions older than 30 days
-- Call manually or schedule with pg_cron: SELECT cron.schedule('0 3 * * *', 'SELECT cleanup_old_bus_positions()');
CREATE OR REPLACE FUNCTION cleanup_old_bus_positions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM bus_positions WHERE recorded_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Terminal coordinates: static seeded config for Harry Reid International Airport, Las Vegas
CREATE TABLE IF NOT EXISTS terminal_coordinates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT UNIQUE NOT NULL,   -- 'T1', 'T3W', 'T3E', 'RAC'
  name           TEXT NOT NULL,
  latitude       DECIMAL(10,7) NOT NULL,
  longitude      DECIMAL(11,7) NOT NULL,
  radius_meters  INT NOT NULL DEFAULT 200
);

-- Seed coordinates (idempotent)
INSERT INTO terminal_coordinates (code, name, latitude, longitude, radius_meters) VALUES
  ('T1',  'Terminal 1',          36.0840, -115.1537, 200),
  ('T3W', 'Terminal 3 West',     36.0797, -115.1480, 200),
  ('T3E', 'Terminal 3 East',     36.0797, -115.1450, 200),
  ('RAC', 'Rental Car Center',   36.0880, -115.1480, 200)
ON CONFLICT (code) DO NOTHING;

-- Enable Realtime for live position streaming
ALTER PUBLICATION supabase_realtime ADD TABLE bus_positions;
