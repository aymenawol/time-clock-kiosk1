-- V2 Phase 2: Row Level Security for all Phase 2 tables
-- Depends on has_role() and get_my_employee_id() from Phase 1 migrations.
-- Date: 2026-05-25

-- ==================== ENABLE RLS ====================

ALTER TABLE public.buses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tablets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breaks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counting_sheets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counting_rows      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_notes       ENABLE ROW LEVEL SECURITY;

-- ==================== BUSES ====================

CREATE POLICY "buses: all authenticated users can read"
  ON public.buses FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "buses: dispatcher and above can update"
  ON public.buses FOR UPDATE
  USING (public.has_role(ARRAY['admin','management','dispatcher','technician']));

CREATE POLICY "buses: admin and management can insert"
  ON public.buses FOR INSERT
  WITH CHECK (public.has_role(ARRAY['admin','management']));

CREATE POLICY "buses: admin and management can delete"
  ON public.buses FOR DELETE
  USING (public.has_role(ARRAY['admin','management']));

-- ==================== TABLETS ====================

CREATE POLICY "tablets: all authenticated users can read"
  ON public.tablets FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "tablets: dispatcher and above can update"
  ON public.tablets FOR UPDATE
  USING (public.has_role(ARRAY['admin','management','dispatcher']));

CREATE POLICY "tablets: admin and management can insert"
  ON public.tablets FOR INSERT
  WITH CHECK (public.has_role(ARRAY['admin','management']));

CREATE POLICY "tablets: admin and management can delete"
  ON public.tablets FOR DELETE
  USING (public.has_role(ARRAY['admin','management']));

-- ==================== BUS STATUS HISTORY ====================

CREATE POLICY "bus_status_history: all authenticated can read"
  ON public.bus_status_history FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "bus_status_history: privileged roles can insert"
  ON public.bus_status_history FOR INSERT
  WITH CHECK (public.has_role(ARRAY['admin','management','dispatcher','technician']));

-- ==================== SHIFTS ====================

CREATE POLICY "shifts: admin, management, dispatcher full access"
  ON public.shifts FOR ALL
  USING (public.has_role(ARRAY['admin','management','dispatcher']));

CREATE POLICY "shifts: driver can select own shifts"
  ON public.shifts FOR SELECT
  USING (
    public.has_role(ARRAY['driver']) AND
    employee_id = public.get_my_employee_id()
  );

CREATE POLICY "shifts: driver can update own active shift"
  ON public.shifts FOR UPDATE
  USING (
    public.has_role(ARRAY['driver']) AND
    employee_id = public.get_my_employee_id() AND
    status = 'active'
  );

CREATE POLICY "shifts: coordinator and supervisor read all"
  ON public.shifts FOR SELECT
  USING (public.has_role(ARRAY['coordinator','supervisor']));

-- ==================== BREAKS ====================

CREATE POLICY "breaks: admin, management, dispatcher full access"
  ON public.breaks FOR ALL
  USING (public.has_role(ARRAY['admin','management','dispatcher']));

CREATE POLICY "breaks: driver can read own breaks"
  ON public.breaks FOR SELECT
  USING (
    public.has_role(ARRAY['driver']) AND
    employee_id = public.get_my_employee_id()
  );

CREATE POLICY "breaks: driver can update own breaks"
  ON public.breaks FOR UPDATE
  USING (
    public.has_role(ARRAY['driver']) AND
    employee_id = public.get_my_employee_id()
  );

CREATE POLICY "breaks: coordinator and supervisor read all"
  ON public.breaks FOR SELECT
  USING (public.has_role(ARRAY['coordinator','supervisor']));

-- ==================== COUNTING SHEETS ====================

CREATE POLICY "counting_sheets: admin, management, dispatcher full access"
  ON public.counting_sheets FOR ALL
  USING (public.has_role(ARRAY['admin','management','dispatcher']));

CREATE POLICY "counting_sheets: driver manages own sheet"
  ON public.counting_sheets FOR ALL
  USING (
    public.has_role(ARRAY['driver']) AND
    driver_id = public.get_my_employee_id()
  );

CREATE POLICY "counting_sheets: coordinator and supervisor read all"
  ON public.counting_sheets FOR SELECT
  USING (public.has_role(ARRAY['coordinator','supervisor']));

-- ==================== COUNTING ROWS ====================

CREATE POLICY "counting_rows: admin, management, dispatcher full access"
  ON public.counting_rows FOR ALL
  USING (public.has_role(ARRAY['admin','management','dispatcher']));

CREATE POLICY "counting_rows: driver manages own rows"
  ON public.counting_rows FOR ALL
  USING (
    public.has_role(ARRAY['driver']) AND
    sheet_id IN (
      SELECT id FROM public.counting_sheets
      WHERE driver_id = public.get_my_employee_id()
    )
  );

CREATE POLICY "counting_rows: coordinator and supervisor read all"
  ON public.counting_rows FOR SELECT
  USING (public.has_role(ARRAY['coordinator','supervisor']));

-- ==================== VEHICLE INSPECTIONS ====================

CREATE POLICY "vehicle_inspections: admin, management, technician, dispatcher full access"
  ON public.vehicle_inspections FOR ALL
  USING (public.has_role(ARRAY['admin','management','technician','dispatcher']));

CREATE POLICY "vehicle_inspections: driver manages own inspections"
  ON public.vehicle_inspections FOR ALL
  USING (
    public.has_role(ARRAY['driver']) AND
    driver_id = public.get_my_employee_id()
  );

CREATE POLICY "vehicle_inspections: coordinator and supervisor read all"
  ON public.vehicle_inspections FOR SELECT
  USING (public.has_role(ARRAY['coordinator','supervisor']));

-- ==================== INSPECTION ITEMS ====================

CREATE POLICY "inspection_items: admin, management, technician, dispatcher full access"
  ON public.inspection_items FOR ALL
  USING (public.has_role(ARRAY['admin','management','technician','dispatcher']));

CREATE POLICY "inspection_items: driver manages items on own inspections"
  ON public.inspection_items FOR ALL
  USING (
    public.has_role(ARRAY['driver']) AND
    inspection_id IN (
      SELECT id FROM public.vehicle_inspections
      WHERE driver_id = public.get_my_employee_id()
    )
  );

CREATE POLICY "inspection_items: coordinator and supervisor read all"
  ON public.inspection_items FOR SELECT
  USING (public.has_role(ARRAY['coordinator','supervisor']));

-- ==================== REPAIR NOTES ====================

CREATE POLICY "repair_notes: admin, management, technician full access"
  ON public.repair_notes FOR ALL
  USING (public.has_role(ARRAY['admin','management','technician']));

CREATE POLICY "repair_notes: dispatcher and supervisors read"
  ON public.repair_notes FOR SELECT
  USING (public.has_role(ARRAY['dispatcher','coordinator','supervisor']));
