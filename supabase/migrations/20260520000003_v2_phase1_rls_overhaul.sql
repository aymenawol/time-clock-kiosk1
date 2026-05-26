-- V2 Phase 1: RLS Overhaul
-- Drops all USING(TRUE) policies and replaces with role-scoped policies.
-- Role is read from app_metadata.role (set by server-side admin API) or
-- falls back to get_my_role() (profiles table lookup).
-- Date: 2026-05-20

-- ==================== DROP OLD PERMISSIVE POLICIES ====================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (policyname ILIKE 'Allow all%' OR policyname ILIKE 'Allow public%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END;
$$;

-- ==================== HELPER: ROLE CHECK ====================
-- Checks both app_metadata (fast, after admin sets it) and profiles table (fallback)

CREATE OR REPLACE FUNCTION public.has_role(check_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'role') = ANY(check_roles),
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = ANY(check_roles),
      FALSE
    )
$$;

-- ==================== EMPLOYEES ====================

-- Admin / management: full access
CREATE POLICY "employees: admin full access"
  ON public.employees FOR ALL
  USING (public.has_role(ARRAY['admin','management']));

-- Staff with read-all permissions
CREATE POLICY "employees: staff read"
  ON public.employees FOR SELECT
  USING (public.has_role(ARRAY['dispatcher','coordinator','supervisor','payroll']));

-- Technicians and fueler/washers can read active employees
CREATE POLICY "employees: tech fw read"
  ON public.employees FOR SELECT
  USING (
    public.has_role(ARRAY['technician','fueler_washer'])
    AND is_active = TRUE
  );

-- Drivers can read their own record
CREATE POLICY "employees: driver own read"
  ON public.employees FOR SELECT
  USING (
    public.has_role(ARRAY['driver'])
    AND auth_user_id = auth.uid()
  );

-- ==================== VEHICLES ====================

CREATE POLICY "vehicles: admin full access"
  ON public.vehicles FOR ALL
  USING (public.has_role(ARRAY['admin','management']));

CREATE POLICY "vehicles: tech full access"
  ON public.vehicles FOR ALL
  USING (public.has_role(ARRAY['technician']));

CREATE POLICY "vehicles: fw update"
  ON public.vehicles FOR UPDATE
  USING (public.has_role(ARRAY['fueler_washer']));

CREATE POLICY "vehicles: staff read"
  ON public.vehicles FOR SELECT
  USING (public.has_role(ARRAY[
    'dispatcher','coordinator','supervisor','payroll',
    'fueler_washer','driver'
  ]));

-- ==================== TIME_ENTRIES ====================

CREATE POLICY "time_entries: admin full access"
  ON public.time_entries FOR ALL
  USING (public.has_role(ARRAY['admin','management']));

CREATE POLICY "time_entries: staff read"
  ON public.time_entries FOR SELECT
  USING (public.has_role(ARRAY['coordinator','supervisor','dispatcher','payroll']));

-- Drivers can manage their own time entries
CREATE POLICY "time_entries: driver own"
  ON public.time_entries FOR ALL
  USING (employee_id = public.get_my_employee_id());

-- ==================== DVI_RECORDS ====================

CREATE POLICY "dvi_records: admin full access"
  ON public.dvi_records FOR ALL
  USING (public.has_role(ARRAY['admin','management']));

CREATE POLICY "dvi_records: tech read"
  ON public.dvi_records FOR SELECT
  USING (public.has_role(ARRAY['technician']));

CREATE POLICY "dvi_records: staff read"
  ON public.dvi_records FOR SELECT
  USING (public.has_role(ARRAY['coordinator','supervisor','dispatcher']));

-- Drivers see/insert own DVI records
CREATE POLICY "dvi_records: driver own"
  ON public.dvi_records FOR ALL
  USING (employee_id = public.get_my_employee_id());

-- ==================== TIMESHEETS ====================

CREATE POLICY "timesheets: admin full access"
  ON public.timesheets FOR ALL
  USING (public.has_role(ARRAY['admin','management']));

CREATE POLICY "timesheets: payroll read"
  ON public.timesheets FOR SELECT
  USING (public.has_role(ARRAY['payroll']));

CREATE POLICY "timesheets: staff read"
  ON public.timesheets FOR SELECT
  USING (public.has_role(ARRAY['coordinator','supervisor','dispatcher']));

-- Drivers see/insert own timesheets
CREATE POLICY "timesheets: driver own"
  ON public.timesheets FOR ALL
  USING (employee_id = public.get_my_employee_id());

-- ==================== INCIDENT_REPORTS ====================

CREATE POLICY "incident_reports: admin full access"
  ON public.incident_reports FOR ALL
  USING (public.has_role(ARRAY['admin','management']));

CREATE POLICY "incident_reports: staff read"
  ON public.incident_reports FOR SELECT
  USING (public.has_role(ARRAY['coordinator','supervisor']));

-- Drivers see/submit own incident reports
CREATE POLICY "incident_reports: driver own"
  ON public.incident_reports FOR ALL
  USING (employee_id = public.get_my_employee_id());

-- ==================== TIME_OFF_REQUESTS ====================

CREATE POLICY "time_off_requests: admin full access"
  ON public.time_off_requests FOR ALL
  USING (public.has_role(ARRAY['admin','management']));

CREATE POLICY "time_off_requests: payroll read"
  ON public.time_off_requests FOR SELECT
  USING (public.has_role(ARRAY['payroll']));

CREATE POLICY "time_off_requests: staff read"
  ON public.time_off_requests FOR SELECT
  USING (public.has_role(ARRAY['coordinator','supervisor']));

-- Drivers see/submit own requests
CREATE POLICY "time_off_requests: driver own"
  ON public.time_off_requests FOR ALL
  USING (employee_id = public.get_my_employee_id());

-- ==================== OVERTIME_REQUESTS ====================

CREATE POLICY "overtime_requests: admin full access"
  ON public.overtime_requests FOR ALL
  USING (public.has_role(ARRAY['admin','management']));

CREATE POLICY "overtime_requests: dispatcher read"
  ON public.overtime_requests FOR SELECT
  USING (public.has_role(ARRAY['dispatcher']));

CREATE POLICY "overtime_requests: payroll read"
  ON public.overtime_requests FOR SELECT
  USING (public.has_role(ARRAY['payroll']));

-- Drivers see/submit own requests
CREATE POLICY "overtime_requests: driver own"
  ON public.overtime_requests FOR ALL
  USING (employee_id = public.get_my_employee_id());

-- ==================== FMLA_CONVERSIONS ====================

CREATE POLICY "fmla_conversions: admin full access"
  ON public.fmla_conversions FOR ALL
  USING (public.has_role(ARRAY['admin','management']));

CREATE POLICY "fmla_conversions: payroll read"
  ON public.fmla_conversions FOR SELECT
  USING (public.has_role(ARRAY['payroll']));

-- Drivers see/submit own requests
CREATE POLICY "fmla_conversions: driver own"
  ON public.fmla_conversions FOR ALL
  USING (employee_id = public.get_my_employee_id());

-- ==================== SAFETY_MEETING_SCHEDULES ====================
-- Public read by anyone (supports the share token flow)
-- Write restricted to admin/management

CREATE POLICY "safety_meeting_schedules: public read"
  ON public.safety_meeting_schedules FOR SELECT
  USING (true);

CREATE POLICY "safety_meeting_schedules: admin write"
  ON public.safety_meeting_schedules FOR INSERT
  WITH CHECK (public.has_role(ARRAY['admin','management']));

CREATE POLICY "safety_meeting_schedules: admin update"
  ON public.safety_meeting_schedules FOR UPDATE
  USING (public.has_role(ARRAY['admin','management']));

CREATE POLICY "safety_meeting_schedules: admin delete"
  ON public.safety_meeting_schedules FOR DELETE
  USING (public.has_role(ARRAY['admin','management']));
