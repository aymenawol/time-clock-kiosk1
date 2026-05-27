-- Phase 7: Break window 45-minute default + counting sheet review table
-- Date: 2026-05-26

-- Update app_settings: set break window duration to 45 minutes
UPDATE public.app_settings
SET break_rules = break_rules
  || '{"break_window_duration_minutes": 45, "default_break_duration_minutes": 45}'::jsonb
WHERE id = 'default';

-- Update breaks table default duration from 15 to 45
ALTER TABLE public.breaks
  ALTER COLUMN duration_minutes SET DEFAULT 45;

-- Update any existing pending breaks that still have default 15-min duration
UPDATE public.breaks
SET duration_minutes = 45
WHERE duration_minutes = 15 AND status = 'pending';
