-- V2 Phase 8: Break subsystem — auto-generate break rows + correct break policy
-- Date: 2026-06-01
--
-- Fixes the broken Phase 7 settings update (it targeted id='default', a no-op)
-- and implements the agreed break policy:
--   • Two 15-minute PAID breaks per shift
--   • Break 1 window opens ~2h15 after shift start (135 min)
--   • Break 2 window opens ~2h before shift end (120 min)
--   • Driver may delay starting a break up to +45 min (flex window)
--   • Overstay: reminder to employee at 17 min, alert to dispatch at 20 min
-- All values are admin-configurable via app_settings.break_rules.

-- ==================== 1. CORRECT THE BREAK POLICY ====================

-- Revert the Phase 7 mistake: breaks are 15-minute (not 45).
ALTER TABLE public.breaks ALTER COLUMN duration_minutes SET DEFAULT 15;

-- Fix existing not-yet-taken breaks that inherited the wrong 45-min default.
UPDATE public.breaks
SET duration_minutes = 15
WHERE duration_minutes = 45 AND status = 'pending';

-- Upsert the singleton settings row with the full, correct break_rules.
-- (ON CONFLICT only touches break_rules — overtime_rules / notification_preferences are preserved.)
INSERT INTO public.app_settings (id, break_rules)
VALUES ('singleton', '{
  "break_count": 2,
  "duration_minutes": 15,
  "flex_minutes": 45,
  "break1_after_start_minutes": 135,
  "break2_before_end_minutes": 120,
  "default_shift_minutes": 480,
  "overstay_reminder_minutes": 17,
  "overstay_alert_minutes": 20,
  "allow_dispatcher_override": true
}'::jsonb)
ON CONFLICT (id) DO UPDATE SET break_rules = EXCLUDED.break_rules,
                               updated_at  = now();

-- ==================== 2. generate_breaks(shift_id) ====================
-- Idempotently creates the 1–2 break rows for a shift from its actual_start
-- and the configured break_rules. Safe to call multiple times.

CREATE OR REPLACE FUNCTION public.generate_breaks(p_shift_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift   public.shifts%ROWTYPE;
  v_rules   JSONB;
  v_dur     INT;
  v_flex    INT;
  v_b1      INT;
  v_b2      INT;
  v_def     INT;
  v_start   TIMESTAMPTZ;
  v_end     TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id;
  IF NOT FOUND OR v_shift.actual_start IS NULL THEN
    RETURN;
  END IF;

  SELECT break_rules INTO v_rules FROM public.app_settings WHERE id = 'singleton';
  v_rules := COALESCE(v_rules, '{}'::jsonb);

  v_dur  := COALESCE((v_rules->>'duration_minutes')::int, 15);
  v_flex := COALESCE((v_rules->>'flex_minutes')::int, 45);
  v_b1   := COALESCE((v_rules->>'break1_after_start_minutes')::int, 135);
  v_b2   := COALESCE((v_rules->>'break2_before_end_minutes')::int, 120);
  v_def  := COALESCE((v_rules->>'default_shift_minutes')::int, 480);

  v_start := v_shift.actual_start;

  -- Estimate the shift end: from scheduled times if available, else default length.
  IF v_shift.scheduled_start IS NOT NULL AND v_shift.scheduled_end IS NOT NULL THEN
    v_end := v_start + CASE
      WHEN v_shift.scheduled_end >= v_shift.scheduled_start
        THEN (v_shift.scheduled_end - v_shift.scheduled_start)
        ELSE (v_shift.scheduled_end - v_shift.scheduled_start) + interval '24 hours'
      END;
  ELSE
    v_end := v_start + make_interval(mins => v_def);
  END IF;

  -- Break 1 — opens v_b1 minutes after start
  INSERT INTO public.breaks
    (shift_id, employee_id, break_number, scheduled_start, window_open, window_close, duration_minutes, status)
  VALUES
    (p_shift_id, v_shift.employee_id, 1,
     v_start + make_interval(mins => v_b1),
     v_start + make_interval(mins => v_b1),
     v_start + make_interval(mins => v_b1 + v_flex),
     v_dur, 'pending')
  ON CONFLICT (shift_id, break_number) DO NOTHING;

  -- Break 2 — opens v_b2 minutes before the estimated end
  INSERT INTO public.breaks
    (shift_id, employee_id, break_number, scheduled_start, window_open, window_close, duration_minutes, status)
  VALUES
    (p_shift_id, v_shift.employee_id, 2,
     v_end - make_interval(mins => v_b2),
     v_end - make_interval(mins => v_b2),
     v_end - make_interval(mins => v_b2) + make_interval(mins => v_flex),
     v_dur, 'pending')
  ON CONFLICT (shift_id, break_number) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_breaks(UUID) TO authenticated, service_role;

-- ==================== 3. AUTO-GENERATE ON SHIFT ACTIVATION ====================
-- Whenever a shift becomes active (dispatcher sign-in inserts status='active'
-- with actual_start=now, or a later update activates it), create its breaks.

CREATE OR REPLACE FUNCTION public.trg_generate_breaks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' AND NEW.actual_start IS NOT NULL THEN
    PERFORM public.generate_breaks(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS generate_breaks_on_active ON public.shifts;
CREATE TRIGGER generate_breaks_on_active
  AFTER INSERT OR UPDATE OF status, actual_start ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_generate_breaks();
