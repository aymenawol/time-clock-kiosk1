-- Phase 5: RLS Policies for all new tables

-- ============================================================
-- HELPERS (ensure they exist from earlier migrations)
-- ============================================================
-- has_role() and get_my_employee_id() assumed from Phase 2.

-- ============================================================
-- CHAT ROOMS
-- ============================================================
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_rooms_read   ON chat_rooms;
DROP POLICY IF EXISTS chat_rooms_write  ON chat_rooms;

-- Eligible chat users: admin, management, dispatcher, supervisor
CREATE POLICY chat_rooms_read ON chat_rooms FOR SELECT
  USING (has_role(ARRAY['admin','management','dispatcher','supervisor']));

CREATE POLICY chat_rooms_write ON chat_rooms FOR INSERT
  WITH CHECK (has_role(ARRAY['admin','management']));

-- ============================================================
-- CHAT ROOM MEMBERS
-- ============================================================
ALTER TABLE chat_room_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_members_read   ON chat_room_members;
DROP POLICY IF EXISTS chat_members_manage ON chat_room_members;

CREATE POLICY chat_members_read ON chat_room_members FOR SELECT
  USING (has_role(ARRAY['admin','management','dispatcher','supervisor']));

CREATE POLICY chat_members_manage ON chat_room_members FOR ALL
  USING (has_role(ARRAY['admin','management']));

-- ============================================================
-- CHAT MESSAGES
-- ============================================================
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_messages_read   ON chat_messages;
DROP POLICY IF EXISTS chat_messages_insert ON chat_messages;
DROP POLICY IF EXISTS chat_messages_delete ON chat_messages;

CREATE POLICY chat_messages_read ON chat_messages FOR SELECT
  USING (has_role(ARRAY['admin','management','dispatcher','supervisor']));

CREATE POLICY chat_messages_insert ON chat_messages FOR INSERT
  WITH CHECK (has_role(ARRAY['admin','management','dispatcher','supervisor']));

-- Only admins can soft-delete messages
CREATE POLICY chat_messages_delete ON chat_messages FOR UPDATE
  USING (has_role(ARRAY['admin']));

-- ============================================================
-- CHAT DELIVERIES / READS / CONFIRMATIONS
-- ============================================================
ALTER TABLE chat_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_deliveries_rw   ON chat_deliveries;
DROP POLICY IF EXISTS chat_reads_rw        ON chat_reads;
DROP POLICY IF EXISTS chat_confirmations_rw ON chat_confirmations;

CREATE POLICY chat_deliveries_rw ON chat_deliveries FOR ALL
  USING (has_role(ARRAY['admin','management','dispatcher','supervisor']));

CREATE POLICY chat_reads_rw ON chat_reads FOR ALL
  USING (has_role(ARRAY['admin','management','dispatcher','supervisor']));

CREATE POLICY chat_confirmations_rw ON chat_confirmations FOR ALL
  USING (has_role(ARRAY['admin','management','dispatcher','supervisor']));

-- ============================================================
-- LOST ITEMS
-- ============================================================
ALTER TABLE lost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE lost_item_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lost_items_read_staff  ON lost_items;
DROP POLICY IF EXISTS lost_items_insert      ON lost_items;
DROP POLICY IF EXISTS lost_items_update      ON lost_items;
DROP POLICY IF EXISTS lost_history_read      ON lost_item_status_history;
DROP POLICY IF EXISTS lost_history_insert    ON lost_item_status_history;

CREATE POLICY lost_items_read_staff ON lost_items FOR SELECT
  USING (has_role(ARRAY['admin','management','dispatcher','supervisor']));

-- Drivers, supervisors, dispatchers can report
CREATE POLICY lost_items_insert ON lost_items FOR INSERT
  WITH CHECK (has_role(ARRAY['admin','management','dispatcher','supervisor','driver']));

CREATE POLICY lost_items_update ON lost_items FOR UPDATE
  USING (has_role(ARRAY['admin','management','dispatcher','supervisor']));

CREATE POLICY lost_history_read ON lost_item_status_history FOR SELECT
  USING (has_role(ARRAY['admin','management','dispatcher','supervisor']));

CREATE POLICY lost_history_insert ON lost_item_status_history FOR INSERT
  WITH CHECK (has_role(ARRAY['admin','management','dispatcher','supervisor']));

-- Storage: lost-and-found bucket policies
CREATE POLICY lost_found_upload ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'lost-and-found' AND has_role(ARRAY['admin','management','dispatcher','supervisor','driver']));

CREATE POLICY lost_found_read ON storage.objects FOR SELECT
  USING (bucket_id = 'lost-and-found' AND has_role(ARRAY['admin','management','dispatcher','supervisor']));

-- ============================================================
-- AIRLINES
-- ============================================================
ALTER TABLE airlines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS airlines_read   ON airlines;
DROP POLICY IF EXISTS airlines_write  ON airlines;

CREATE POLICY airlines_read ON airlines FOR SELECT USING (true);  -- all authenticated
CREATE POLICY airlines_write ON airlines FOR ALL
  USING (has_role(ARRAY['admin']));

-- ============================================================
-- WHEELCHAIR REQUESTS
-- ============================================================
ALTER TABLE wheelchair_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wheelchair_driver_insert  ON wheelchair_requests;
DROP POLICY IF EXISTS wheelchair_driver_select  ON wheelchair_requests;
DROP POLICY IF EXISTS wheelchair_staff_select   ON wheelchair_requests;
DROP POLICY IF EXISTS wheelchair_staff_update   ON wheelchair_requests;

CREATE POLICY wheelchair_driver_insert ON wheelchair_requests FOR INSERT
  WITH CHECK (has_role(ARRAY['admin','management','dispatcher','supervisor','driver']));

CREATE POLICY wheelchair_driver_select ON wheelchair_requests FOR SELECT
  USING (
    driver_id = get_my_employee_id()
    OR has_role(ARRAY['admin','management','dispatcher','supervisor'])
  );

CREATE POLICY wheelchair_staff_update ON wheelchair_requests FOR UPDATE
  USING (has_role(ARRAY['admin','management','dispatcher','supervisor']));

-- ============================================================
-- SESSION OVERRIDES
-- ============================================================
ALTER TABLE session_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_overrides_admin_write  ON session_overrides;
DROP POLICY IF EXISTS session_overrides_emp_select   ON session_overrides;
DROP POLICY IF EXISTS session_overrides_admin_select ON session_overrides;

CREATE POLICY session_overrides_admin_write ON session_overrides FOR ALL
  USING (has_role(ARRAY['admin']));

-- Employee can see their own active overrides (motion lock check)
CREATE POLICY session_overrides_emp_select ON session_overrides FOR SELECT
  USING (
    employee_id = get_my_employee_id()
    OR has_role(ARRAY['admin','management'])
  );

-- ============================================================
-- OFFLINE SYNC CONFLICTS
-- ============================================================
ALTER TABLE offline_sync_conflicts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sync_conflicts_rw ON offline_sync_conflicts;

CREATE POLICY sync_conflicts_rw ON offline_sync_conflicts FOR ALL
  USING (has_role(ARRAY['admin','management']));

-- Allow driver insert (client-side sync)
DROP POLICY IF EXISTS sync_conflicts_driver_insert ON offline_sync_conflicts;
CREATE POLICY sync_conflicts_driver_insert ON offline_sync_conflicts FOR INSERT
  WITH CHECK (employee_id = get_my_employee_id());

-- ============================================================
-- DRIVER PERFORMANCE SNAPSHOTS
-- ============================================================
ALTER TABLE driver_performance_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS perf_own_read    ON driver_performance_snapshots;
DROP POLICY IF EXISTS perf_staff_read  ON driver_performance_snapshots;
DROP POLICY IF EXISTS perf_write       ON driver_performance_snapshots;

CREATE POLICY perf_own_read ON driver_performance_snapshots FOR SELECT
  USING (employee_id = get_my_employee_id());

CREATE POLICY perf_staff_read ON driver_performance_snapshots FOR SELECT
  USING (has_role(ARRAY['admin','management','supervisor']));

CREATE POLICY perf_write ON driver_performance_snapshots FOR ALL
  USING (has_role(ARRAY['admin','management','dispatcher']));

-- ============================================================
-- EMERGENCY EVENTS + ACKNOWLEDGEMENTS
-- ============================================================
ALTER TABLE emergency_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_acknowledgements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS emergency_read_all   ON emergency_events;
DROP POLICY IF EXISTS emergency_admin_write ON emergency_events;
DROP POLICY IF EXISTS emergency_ack_read   ON emergency_acknowledgements;
DROP POLICY IF EXISTS emergency_ack_insert ON emergency_acknowledgements;

-- All authenticated users can read active emergency events (for modal display)
CREATE POLICY emergency_read_all ON emergency_events FOR SELECT USING (true);

CREATE POLICY emergency_admin_write ON emergency_events FOR ALL
  USING (has_role(ARRAY['admin']));

CREATE POLICY emergency_ack_read ON emergency_acknowledgements FOR SELECT USING (true);

-- Anyone authenticated can acknowledge
CREATE POLICY emergency_ack_insert ON emergency_acknowledgements FOR INSERT
  WITH CHECK (employee_id = get_my_employee_id());

-- ============================================================
-- NOTIFICATION QUEUE + LOG
-- ============================================================
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_queue_admin   ON notification_queue;
DROP POLICY IF EXISTS notif_log_admin     ON notification_log;
DROP POLICY IF EXISTS notif_log_own       ON notification_log;
DROP POLICY IF EXISTS email_templates_rw  ON email_templates;

CREATE POLICY notif_queue_admin ON notification_queue FOR ALL
  USING (has_role(ARRAY['admin','management']));

CREATE POLICY notif_log_admin ON notification_log FOR SELECT
  USING (has_role(ARRAY['admin','management']));

CREATE POLICY notif_log_own ON notification_log FOR SELECT
  USING (recipient_id = get_my_employee_id());

CREATE POLICY email_templates_rw ON email_templates FOR ALL
  USING (has_role(ARRAY['admin']));
