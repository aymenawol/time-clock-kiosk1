-- V2 Phase 11 (N8): notify on fatigue alerts + dedup weekly alert types.
-- Date: 2026-06-03
--
-- (1) A partial unique index so consecutive_days / ot_threshold alerts (which
--     have NULL shift_id) can be upserted per employee without duplicating an
--     already-open alert of the same type.
-- (2) An AFTER INSERT trigger that enqueues an in-app + email notification to
--     the affected driver AND to every active dispatcher / supervisor, so
--     fatigue alerts actually reach someone. Reuses notification_queue, which
--     the phase-9 trigger materializes into the in-app bell and the processor
--     turns into email.

-- (1) Dedup open weekly alerts (one open consecutive_days / ot_threshold per employee)
CREATE UNIQUE INDEX IF NOT EXISTS uq_fatigue_open_weekly
  ON public.fatigue_alerts (employee_id, alert_type)
  WHERE shift_id IS NULL AND resolved_at IS NULL AND dismissed_at IS NULL;

-- (2) Notification fan-out
CREATE OR REPLACE FUNCTION public.fn_fatigue_alert_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label TEXT;
  v_msg   TEXT;
BEGIN
  v_label := CASE NEW.alert_type
    WHEN 'single_shift'     THEN 'Long shift'
    WHEN 'consecutive_days' THEN 'Too many days worked'
    WHEN 'ot_threshold'     THEN 'High weekly overtime'
    ELSE 'Fatigue alert'
  END;
  v_msg := CASE NEW.alert_type
    WHEN 'single_shift'     THEN 'A shift of ' || COALESCE(NEW.shift_hours::text, '?') || ' hours was recorded.'
    WHEN 'consecutive_days' THEN COALESCE(NEW.consecutive_count::text, 'Several') || ' days worked in one week.'
    WHEN 'ot_threshold'     THEN COALESCE(NEW.weekly_ot_hours::text, 'High') || ' OT hours this week.'
    ELSE 'A fatigue alert was raised.'
  END;

  -- Notify the affected driver.
  INSERT INTO public.notification_queue (recipient_id, event_type, channel, payload)
  VALUES (NEW.employee_id, 'fatigue_alert', 'in_app',
          jsonb_build_object('title', v_label, 'message', v_msg, 'alert_id', NEW.id));

  -- Notify active dispatchers / supervisors / management.
  INSERT INTO public.notification_queue (recipient_id, event_type, channel, payload)
  SELECT e.id, 'fatigue_alert', 'in_app',
         jsonb_build_object('title', 'Fatigue: ' || v_label, 'message', v_msg, 'alert_id', NEW.id, 'employee_id', NEW.employee_id)
  FROM public.employees e
  WHERE e.status = 'active'
    AND e.auth_user_id IS NOT NULL
    AND e.role IN ('dispatcher', 'supervisor', 'management');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fatigue_alert_notify ON public.fatigue_alerts;
CREATE TRIGGER fatigue_alert_notify
  AFTER INSERT ON public.fatigue_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_fatigue_alert_notify();
