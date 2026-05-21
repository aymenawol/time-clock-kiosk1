-- Migration: Add lunch waiver feature to time entries
-- Date: 2025-01-01
-- Description: Adds lunch_waiver column to time_entries and updates active_clock_ins view

-- Add lunch_waiver column to time_entries table
ALTER TABLE time_entries 
ADD COLUMN IF NOT EXISTS lunch_waiver BOOLEAN NOT NULL DEFAULT FALSE;

-- Add expected_clock_out column to time_entries table
ALTER TABLE time_entries 
ADD COLUMN IF NOT EXISTS expected_clock_out TIMESTAMP WITH TIME ZONE;

-- Drop the existing view first (required when changing column structure)
DROP VIEW IF EXISTS active_clock_ins;

-- Recreate the active_clock_ins view to include lunch_waiver
CREATE VIEW active_clock_ins AS
SELECT 
  te.id as time_entry_id,
  e.employee_id,
  e.name,
  te.clock_in_time as clock_in,
  te.lunch_waiver,
  te.expected_clock_out,
  CONCAT(
    FLOOR(EXTRACT(EPOCH FROM (NOW() - te.clock_in_time)) / 3600)::TEXT,
    ':',
    LPAD(FLOOR(MOD(EXTRACT(EPOCH FROM (NOW() - te.clock_in_time)), 3600) / 60)::TEXT, 2, '0')
  ) as duration_hours
FROM time_entries te
JOIN employees e ON te.employee_id = e.id
WHERE te.clock_out_time IS NULL;

-- Create index for faster queries on lunch_waiver
CREATE INDEX IF NOT EXISTS idx_time_entries_lunch_waiver ON time_entries(lunch_waiver);

-- Comment on the column
COMMENT ON COLUMN time_entries.lunch_waiver IS 'If true, employee waives lunch and works 8 hours. If false, employee takes lunch and works 8.5 hours.';
COMMENT ON COLUMN time_entries.expected_clock_out IS 'The expected clock out time based on clock in time and lunch waiver status.';
