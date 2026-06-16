-- V2 Phase 9: Converge in-app notifications onto the `notifications` table.
-- Date: 2026-06-01
--
-- Problem (audit): producers enqueue in_app rows into notification_queue, the
-- processor marks them 'sent' but performs no in-app delivery, and the frontend
-- subscribes to nothing — so in-app notifications never reach users.
--
-- Fix: a trigger materializes every in_app notification_queue row into the
-- `notifications` table (which has is_read/read_at and the bell reads). This
-- covers ALL current and future producers automatically; the processor still
-- handles email/audit for the queue row.

CREATE OR REPLACE FUNCTION public.fn_queue_to_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID;
  v_type TEXT;
BEGIN
  IF NEW.channel <> 'in_app' THEN
    RETURN NEW;
  END IF;

  SELECT auth_user_id INTO v_user FROM public.employees WHERE id = NEW.recipient_id;
  IF v_user IS NULL THEN
    RETURN NEW;  -- recipient has no login account → nothing to show in-app
  END IF;

  -- Map queue event_type → notifications.type (CHECK-constrained enum); unknown → 'info'
  v_type := CASE NEW.event_type
    WHEN 'break_overdue'         THEN 'break_overdue'
    WHEN 'break_missed'          THEN 'break_overdue'
    WHEN 'hazard_alert'          THEN 'emergency_alert'
    WHEN 'emergency'             THEN 'emergency_alert'
    WHEN 'emergency_alert'       THEN 'emergency_alert'
    WHEN 'wheelchair_request'    THEN 'wheelchair_request'
    WHEN 'wheelchair_escalation' THEN 'wheelchair_request'
    WHEN 'form_approved'         THEN 'form_approved'
    WHEN 'form_denied'           THEN 'form_denied'
    WHEN 'form_returned'         THEN 'form_returned'
    WHEN 'form_submitted'        THEN 'form_submitted'
    WHEN 'overtime_awarded'      THEN 'overtime_shift'
    WHEN 'overtime_shift'        THEN 'overtime_shift'
    WHEN 'bid_awarded'           THEN 'bid_awarded'
    WHEN 'shift_bid_open'        THEN 'shift_bid_open'
    WHEN 'safety_meeting'        THEN 'safety_meeting'
    WHEN 'maintenance_reminder'  THEN 'maintenance_reminder'
    WHEN 'chat_message'          THEN 'chat_message'
    ELSE 'info'
  END;

  INSERT INTO public.notifications (user_id, employee_id, type, title, body, data)
  VALUES (
    v_user,
    NEW.recipient_id,
    v_type,
    COALESCE(NULLIF(NEW.payload->>'title', ''), initcap(replace(NEW.event_type, '_', ' '))),
    COALESCE(NEW.payload->>'message', NEW.payload->>'body'),
    COALESCE(NEW.payload, '{}'::jsonb)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS queue_to_notifications ON public.notification_queue;
CREATE TRIGGER queue_to_notifications
  AFTER INSERT ON public.notification_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_queue_to_notifications();
