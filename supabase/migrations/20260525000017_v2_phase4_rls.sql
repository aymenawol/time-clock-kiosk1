-- Phase 4: Row Level Security policies

-- ════════════════════════════════════════
-- bus_positions
-- ════════════════════════════════════════
ALTER TABLE bus_positions ENABLE ROW LEVEL SECURITY;

-- Drivers can INSERT their own positions (driver_id must match their employee record)
DROP POLICY IF EXISTS "bus_positions_driver_insert"  ON bus_positions;
CREATE POLICY "bus_positions_driver_insert" ON bus_positions
  FOR INSERT TO authenticated
  WITH CHECK (driver_id = get_my_employee_id());

-- Admin / management / dispatcher / supervisor can SELECT all
DROP POLICY IF EXISTS "bus_positions_staff_select"   ON bus_positions;
CREATE POLICY "bus_positions_staff_select" ON bus_positions
  FOR SELECT TO authenticated
  USING (has_role(ARRAY['admin','management','dispatcher','supervisor']));

-- Drivers can SELECT their own positions (useful for the driver dashboard GPS debug panel)
DROP POLICY IF EXISTS "bus_positions_driver_select"  ON bus_positions;
CREATE POLICY "bus_positions_driver_select" ON bus_positions
  FOR SELECT TO authenticated
  USING (driver_id = get_my_employee_id());

-- Admin can DELETE (for cleanup)
DROP POLICY IF EXISTS "bus_positions_admin_delete"   ON bus_positions;
CREATE POLICY "bus_positions_admin_delete" ON bus_positions
  FOR DELETE TO authenticated
  USING (has_role(ARRAY['admin']));

-- ════════════════════════════════════════
-- terminal_coordinates
-- ════════════════════════════════════════
ALTER TABLE terminal_coordinates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "terminal_coords_all_read"     ON terminal_coordinates;
CREATE POLICY "terminal_coords_all_read" ON terminal_coordinates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "terminal_coords_admin_write"  ON terminal_coordinates;
CREATE POLICY "terminal_coords_admin_write" ON terminal_coordinates
  FOR ALL TO authenticated
  USING (has_role(ARRAY['admin']))
  WITH CHECK (has_role(ARRAY['admin']));

-- ════════════════════════════════════════
-- pay_periods
-- ════════════════════════════════════════
ALTER TABLE pay_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pay_periods_read"             ON pay_periods;
CREATE POLICY "pay_periods_read" ON pay_periods
  FOR SELECT TO authenticated
  USING (has_role(ARRAY['admin','management','payroll']));

DROP POLICY IF EXISTS "pay_periods_write"            ON pay_periods;
CREATE POLICY "pay_periods_write" ON pay_periods
  FOR ALL TO authenticated
  USING (has_role(ARRAY['admin','payroll']))
  WITH CHECK (has_role(ARRAY['admin','payroll']));

-- ════════════════════════════════════════
-- daily_hours_records
-- ════════════════════════════════════════
ALTER TABLE daily_hours_records ENABLE ROW LEVEL SECURITY;

-- Employee can see their own records
DROP POLICY IF EXISTS "daily_hours_employee_select"  ON daily_hours_records;
CREATE POLICY "daily_hours_employee_select" ON daily_hours_records
  FOR SELECT TO authenticated
  USING (employee_id = get_my_employee_id());

-- Admin / management / payroll can see all
DROP POLICY IF EXISTS "daily_hours_staff_select"     ON daily_hours_records;
CREATE POLICY "daily_hours_staff_select" ON daily_hours_records
  FOR SELECT TO authenticated
  USING (has_role(ARRAY['admin','management','payroll']));

-- Admin / payroll can write (insert, update, delete)
DROP POLICY IF EXISTS "daily_hours_write"            ON daily_hours_records;
CREATE POLICY "daily_hours_write" ON daily_hours_records
  FOR ALL TO authenticated
  USING (has_role(ARRAY['admin','payroll']))
  WITH CHECK (has_role(ARRAY['admin','payroll']));

-- ════════════════════════════════════════
-- payroll_exports
-- ════════════════════════════════════════
ALTER TABLE payroll_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_exports_rw"           ON payroll_exports;
CREATE POLICY "payroll_exports_rw" ON payroll_exports
  FOR ALL TO authenticated
  USING (has_role(ARRAY['admin','payroll']))
  WITH CHECK (has_role(ARRAY['admin','payroll']));

-- ════════════════════════════════════════
-- fatigue_alerts
-- ════════════════════════════════════════
ALTER TABLE fatigue_alerts ENABLE ROW LEVEL SECURITY;

-- Management / admin / dispatcher / supervisor can read
DROP POLICY IF EXISTS "fatigue_alerts_read"          ON fatigue_alerts;
CREATE POLICY "fatigue_alerts_read" ON fatigue_alerts
  FOR SELECT TO authenticated
  USING (has_role(ARRAY['admin','management','dispatcher','supervisor']));

-- Employee can see their own alerts
DROP POLICY IF EXISTS "fatigue_alerts_own_read"      ON fatigue_alerts;
CREATE POLICY "fatigue_alerts_own_read" ON fatigue_alerts
  FOR SELECT TO authenticated
  USING (employee_id = get_my_employee_id());

-- Admin / management / system can insert (triggered from server action)
DROP POLICY IF EXISTS "fatigue_alerts_insert"        ON fatigue_alerts;
CREATE POLICY "fatigue_alerts_insert" ON fatigue_alerts
  FOR INSERT TO authenticated
  WITH CHECK (has_role(ARRAY['admin','management','dispatcher']));

-- Admin / management / dispatcher can update (resolve / dismiss)
DROP POLICY IF EXISTS "fatigue_alerts_update"        ON fatigue_alerts;
CREATE POLICY "fatigue_alerts_update" ON fatigue_alerts
  FOR UPDATE TO authenticated
  USING (has_role(ARRAY['admin','management','dispatcher']))
  WITH CHECK (has_role(ARRAY['admin','management','dispatcher']));
