-- V2 Phase 11 (H5): Legacy schema consolidation — drop dead v1 tables,
-- prune dead realtime publication members, and retire the open-RLS on the
-- one legacy table we keep (safety_meeting_schedules, still backing the
-- public /safety/[token] share page).
-- Date: 2026-06-01
--
-- Pre-flight verified in repo: no v2 table has a FK referencing any of the
-- tables dropped here, and no app/lib/component code reads them. The two
-- remaining legacy reads were migrated to v2 equivalents in the same change:
--   * app/admin/reports/report-data.ts  time_entries          -> shifts
--   * app/fueler/page.tsx               safety_meeting_schedules -> safety_meetings
--
-- Dropping a table automatically removes it from the supabase_realtime
-- publication and drops its policies/indexes/dependent objects (CASCADE),
-- so no explicit ALTER PUBLICATION ... DROP is needed for the dropped tables.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Drop the legacy clock-in / inspection / timesheet stack.
--    Order is handled by CASCADE; active_clock_ins view depends on time_entries.
-- ──────────────────────────────────────────────────────────────────────────
DROP VIEW  IF EXISTS public.active_clock_ins;

DROP TABLE IF EXISTS public.dvi_records CASCADE;   -- FK -> time_entries, vehicles
DROP TABLE IF EXISTS public.timesheets  CASCADE;   -- FK -> time_entries
DROP TABLE IF EXISTS public.time_entries CASCADE;
DROP TABLE IF EXISTS public.vehicles     CASCADE;  -- replaced by `buses`

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Drop the 4 flat v1 form tables (replaced by `form_submissions`).
-- ──────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.incident_reports   CASCADE;
DROP TABLE IF EXISTS public.time_off_requests   CASCADE;
DROP TABLE IF EXISTS public.overtime_requests   CASCADE;
DROP TABLE IF EXISTS public.fmla_conversions    CASCADE;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Retire the OPEN RLS on safety_meeting_schedules (KEPT — backs the public
--    /safety/[token] share page). Previously every op was `USING (true)` for
--    anon. Now: public may SELECT only active rows; writes require auth.
--    Also pull it from realtime (the public page does a one-shot fetch, no
--    subscription) so the open table is no longer broadcast.
-- ──────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'safety_meeting_schedules'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.safety_meeting_schedules;
  END IF;
END;
$$;

DROP POLICY IF EXISTS "Allow public read access"   ON public.safety_meeting_schedules;
DROP POLICY IF EXISTS "Allow public insert access" ON public.safety_meeting_schedules;
DROP POLICY IF EXISTS "Allow public update access" ON public.safety_meeting_schedules;
DROP POLICY IF EXISTS "Allow public delete access" ON public.safety_meeting_schedules;

-- Public (anon + authenticated) may read only active, shared schedules.
CREATE POLICY "sms_public_read_active" ON public.safety_meeting_schedules
  FOR SELECT USING (is_active = true);

-- Only authenticated staff may create / edit / remove schedules.
CREATE POLICY "sms_auth_insert" ON public.safety_meeting_schedules
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sms_auth_update" ON public.safety_meeting_schedules
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sms_auth_delete" ON public.safety_meeting_schedules
  FOR DELETE TO authenticated USING (true);
