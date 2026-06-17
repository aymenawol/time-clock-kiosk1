-- V2 Phase 12: Performance + authorization hardening
-- Date: 2026-06-16
--
-- Two low-risk audit fixes:
--   L-3  compound index for the hot "this employee, this day" shift lookup
--   L-4  scope terminal_coordinates reads to operational roles
--
-- NOTE: safety_meeting_schedules write hardening (audit M-7) is handled by
-- 20260616000001_v2_phase12_security_hardening.sql, which also drops the
-- leftover phase-1 open read policy — not duplicated here.

-- ── L-3: compound shifts(employee_id, date) index ───────────────────────────
-- Single-column indexes on employee_id and date already exist; this compound
-- index serves the driver dashboard / payroll / fatigue "employee + day" path
-- without a second lookup.
CREATE INDEX IF NOT EXISTS idx_shifts_employee_date
  ON public.shifts (employee_id, date);

-- ── L-4: scope terminal_coordinates SELECT to ops roles ─────────────────────
-- Was USING (true) (any authenticated user). No client code reads this table;
-- server paths use the service role, so restricting to ops roles is safe.
DROP POLICY IF EXISTS "terminal_coords_all_read" ON public.terminal_coordinates;
CREATE POLICY "terminal_coords_ops_read" ON public.terminal_coordinates
  FOR SELECT TO authenticated
  USING (public.has_role(ARRAY['admin','management','dispatcher','supervisor','coordinator']));
