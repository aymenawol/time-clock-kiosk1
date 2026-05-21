-- Migration: Initialize core schema for time-clock kiosk
-- Date: 2024-01-01
-- Purpose: Recreate foundational tables, indexes, RLS, and active_clock_ins view.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==================== CORE TABLES ====================

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  pin TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_number TEXT NOT NULL UNIQUE,
  vehicle_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  clock_in_time TIMESTAMP WITH TIME ZONE NOT NULL,
  clock_out_time TIMESTAMP WITH TIME ZONE,
  date DATE NOT NULL,
  total_hours NUMERIC(5,2),
  lunch_waiver BOOLEAN NOT NULL DEFAULT FALSE,
  expected_clock_out TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dvi_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  time_entry_id UUID REFERENCES time_entries(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  inspection_date TIMESTAMP WITH TIME ZONE NOT NULL,
  inspection_type TEXT NOT NULL DEFAULT 'pre-trip' CHECK (inspection_type IN ('pre-trip', 'post-trip')),
  inspection_data JSONB,
  notes TEXT,
  is_passed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  time_entry_id UUID REFERENCES time_entries(id) ON DELETE SET NULL,
  operator_name TEXT,
  bus_number TEXT,
  check_in TEXT,
  check_out TEXT,
  brk_windows TEXT,
  entries JSONB,
  totals JSONB,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee ON time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_open ON time_entries(employee_id, clock_out_time);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date);
CREATE INDEX IF NOT EXISTS idx_time_entries_lunch_waiver ON time_entries(lunch_waiver);
CREATE INDEX IF NOT EXISTS idx_dvi_records_employee ON dvi_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_dvi_records_time_entry ON dvi_records(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_dvi_records_date ON dvi_records(inspection_date);
CREATE INDEX IF NOT EXISTS idx_timesheets_employee ON timesheets(employee_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_time_entry ON timesheets(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_date ON timesheets(date);
CREATE INDEX IF NOT EXISTS idx_vehicles_active ON vehicles(is_active);

-- ==================== VIEW ====================

DROP VIEW IF EXISTS active_clock_ins;

CREATE VIEW active_clock_ins AS
SELECT
  te.id AS time_entry_id,
  e.employee_id,
  e.name,
  te.clock_in_time AS clock_in,
  te.lunch_waiver,
  te.expected_clock_out,
  CONCAT(
    FLOOR(EXTRACT(EPOCH FROM (NOW() - te.clock_in_time)) / 3600)::TEXT,
    ':',
    LPAD(FLOOR(MOD(EXTRACT(EPOCH FROM (NOW() - te.clock_in_time)), 3600) / 60)::TEXT, 2, '0')
  ) AS duration_hours
FROM time_entries te
JOIN employees e ON te.employee_id = e.id
WHERE te.clock_out_time IS NULL;

-- ==================== RLS ====================

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE dvi_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'employees' AND policyname = 'Allow all for employees'
  ) THEN
    CREATE POLICY "Allow all for employees" ON employees FOR ALL USING (TRUE) WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vehicles' AND policyname = 'Allow all for vehicles'
  ) THEN
    CREATE POLICY "Allow all for vehicles" ON vehicles FOR ALL USING (TRUE) WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'time_entries' AND policyname = 'Allow all for time_entries'
  ) THEN
    CREATE POLICY "Allow all for time_entries" ON time_entries FOR ALL USING (TRUE) WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dvi_records' AND policyname = 'Allow all for dvi_records'
  ) THEN
    CREATE POLICY "Allow all for dvi_records" ON dvi_records FOR ALL USING (TRUE) WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'timesheets' AND policyname = 'Allow all for timesheets'
  ) THEN
    CREATE POLICY "Allow all for timesheets" ON timesheets FOR ALL USING (TRUE) WITH CHECK (TRUE);
  END IF;
END;
$$;

-- ==================== REALTIME ====================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dvi_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE dvi_records;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'timesheets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE timesheets;
  END IF;
END;
$$;

COMMENT ON COLUMN time_entries.lunch_waiver IS 'If true, employee waives lunch and works 8 hours. If false, employee takes lunch and works 8.5 hours.';
COMMENT ON COLUMN time_entries.expected_clock_out IS 'Expected clock-out time based on clock-in and lunch waiver.';
