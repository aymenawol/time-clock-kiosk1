-- Migration: Enable realtime for existing tables (DVI and Timesheets)
-- Date: 2024-12-22
-- Run this AFTER the main migration if you want notifications for DVI and Timesheet submissions

-- Enable realtime for DVI records and Timesheets
-- Note: If these tables are already in supabase_realtime, this will show an error (safe to ignore)
ALTER PUBLICATION supabase_realtime ADD TABLE dvi_records;
ALTER PUBLICATION supabase_realtime ADD TABLE timesheets;
