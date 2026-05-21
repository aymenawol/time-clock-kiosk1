-- Migration: Enable realtime for existing tables (DVI and Timesheets)
-- Date: 2024-12-22
-- Run this AFTER the main migration if you want notifications for DVI and Timesheet submissions

-- Enable realtime for DVI records and Timesheets
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
