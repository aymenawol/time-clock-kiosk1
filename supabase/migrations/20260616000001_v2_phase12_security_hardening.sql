-- V2 Phase 12: Security hardening (audit remediation).
-- Date: 2026-06-16
--
-- Addresses three findings from the security audit:
--   C1  current_bus_positions shipped WITHOUT RLS  -> live driver GPS was
--       readable by anyone holding the public anon key. Enable RLS with the
--       same scoping as bus_positions, and make latest_bus_positions a
--       security_invoker view so it honours the caller's RLS.
--   H1  safety_meeting_schedules write policies were `USING (true)` (any
--       authenticated user could insert/update/delete) and a leftover
--       phase-1 `public read USING (true)` policy made the is_active read
--       restriction moot. Role-gate writes; drop the open read policy.
--   M2  cleanup_old_bus_positions() existed but was never scheduled. Schedule
--       it via pg_cron (defensively, if the extension is present).

-- ════════════════════════════════════════════════════════════════════════════
-- C1 — RLS on current_bus_positions + security_invoker on latest_bus_positions
-- ════════════════════════════════════════════════════════════════════════════
-- Writes to this table happen ONLY through the SECURITY DEFINER trigger
-- fn_upsert_current_position (on bus_positions INSERT), which bypasses RLS, so
-- no INSERT/UPDATE policy is needed for clients. Anon matches no policy => denied.
ALTER TABLE public.current_bus_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "current_positions_staff_select"  ON public.current_bus_positions;
CREATE POLICY "current_positions_staff_select" ON public.current_bus_positions
  FOR SELECT TO authenticated
  USING (has_role(ARRAY['admin','management','dispatcher','supervisor']));

DROP POLICY IF EXISTS "current_positions_driver_select" ON public.current_bus_positions;
CREATE POLICY "current_positions_driver_select" ON public.current_bus_positions
  FOR SELECT TO authenticated
  USING (driver_id = get_my_employee_id());

DROP POLICY IF EXISTS "current_positions_admin_delete"  ON public.current_bus_positions;
CREATE POLICY "current_positions_admin_delete" ON public.current_bus_positions
  FOR DELETE TO authenticated
  USING (has_role(ARRAY['admin']));

-- Recreate the view so it runs with the querying user's privileges (PG15+),
-- i.e. it enforces the RLS above instead of the view owner's bypass.
DROP VIEW IF EXISTS public.latest_bus_positions;
CREATE VIEW public.latest_bus_positions
  WITH (security_invoker = true) AS
  SELECT bus_id, driver_id, shift_id, latitude, longitude, speed, heading, accuracy, recorded_at
  FROM public.current_bus_positions;

-- ════════════════════════════════════════════════════════════════════════════
-- H1 — Role-gate safety_meeting_schedules writes; remove the open read policy
-- ════════════════════════════════════════════════════════════════════════════
-- Leftover phase-1 policy that made sms_public_read_active (is_active=true) moot.
DROP POLICY IF EXISTS "safety_meeting_schedules: public read" ON public.safety_meeting_schedules;

-- Replace the permissive `USING (true)` write policies with role-gated ones.
DROP POLICY IF EXISTS "sms_auth_insert" ON public.safety_meeting_schedules;
DROP POLICY IF EXISTS "sms_auth_update" ON public.safety_meeting_schedules;
DROP POLICY IF EXISTS "sms_auth_delete" ON public.safety_meeting_schedules;

CREATE POLICY "sms_admin_insert" ON public.safety_meeting_schedules
  FOR INSERT TO authenticated
  WITH CHECK (has_role(ARRAY['admin','management']));

CREATE POLICY "sms_admin_update" ON public.safety_meeting_schedules
  FOR UPDATE TO authenticated
  USING (has_role(ARRAY['admin','management']))
  WITH CHECK (has_role(ARRAY['admin','management']));

CREATE POLICY "sms_admin_delete" ON public.safety_meeting_schedules
  FOR DELETE TO authenticated
  USING (has_role(ARRAY['admin','management']));

-- ════════════════════════════════════════════════════════════════════════════
-- M2 — Schedule the GPS retention cleanup (was defined but never scheduled)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nightly-gps-cleanup') THEN
      PERFORM cron.unschedule('nightly-gps-cleanup');
    END IF;
    PERFORM cron.schedule(
      'nightly-gps-cleanup',
      '0 3 * * *',
      'SELECT public.cleanup_old_bus_positions();'
    );
  ELSE
    RAISE NOTICE 'pg_cron not installed: enable it (Supabase Dashboard -> Database -> Extensions), then schedule cleanup_old_bus_positions() to run nightly.';
  END IF;
END;
$$;
