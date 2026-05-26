-- V2 Phase 3: Row Level Security for all Phase 3 tables
-- Date: 2026-05-25

-- ── Helper reference ──────────────────────────────────────────────────────────
-- has_role(roles TEXT[]) → true if current user's app_metadata.role is in the array
-- get_my_employee_id() → returns employees.id for current user

-- ══════════════════════════════════════════════════════════════════════════════
-- SHIFT BID CYCLES
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.shift_bid_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bid_cycles_read_published" ON public.shift_bid_cycles
  FOR SELECT USING (
    status IN ('published','locked','awarded')
    OR has_role(ARRAY['admin','management'])
  );

CREATE POLICY "bid_cycles_admin_all" ON public.shift_bid_cycles
  FOR ALL USING (has_role(ARRAY['admin','management']))
  WITH CHECK (has_role(ARRAY['admin','management']));

-- ══════════════════════════════════════════════════════════════════════════════
-- SHIFT BID SLOTS
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.shift_bid_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bid_slots_read" ON public.shift_bid_slots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shift_bid_cycles c
      WHERE c.id = shift_bid_slots.cycle_id
        AND (c.status IN ('published','locked','awarded') OR has_role(ARRAY['admin','management']))
    )
  );

CREATE POLICY "bid_slots_admin_write" ON public.shift_bid_slots
  FOR ALL USING (has_role(ARRAY['admin','management']))
  WITH CHECK (has_role(ARRAY['admin','management']));

-- ══════════════════════════════════════════════════════════════════════════════
-- SHIFT BID SUBMISSIONS
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.shift_bid_submissions ENABLE ROW LEVEL SECURITY;

-- Driver can see and manage own submission
CREATE POLICY "bid_subs_own" ON public.shift_bid_submissions
  FOR ALL USING (employee_id = get_my_employee_id())
  WITH CHECK (employee_id = get_my_employee_id());

-- Admin/management see all
CREATE POLICY "bid_subs_admin" ON public.shift_bid_submissions
  FOR ALL USING (has_role(ARRAY['admin','management']))
  WITH CHECK (has_role(ARRAY['admin','management']));

-- ══════════════════════════════════════════════════════════════════════════════
-- SHIFT BID AWARDS
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.shift_bid_awards ENABLE ROW LEVEL SECURITY;

-- Driver can see own award
CREATE POLICY "bid_awards_own" ON public.shift_bid_awards
  FOR SELECT USING (employee_id = get_my_employee_id());

-- Admin full access
CREATE POLICY "bid_awards_admin" ON public.shift_bid_awards
  FOR ALL USING (has_role(ARRAY['admin','management']))
  WITH CHECK (has_role(ARRAY['admin','management']));

-- ══════════════════════════════════════════════════════════════════════════════
-- OVERTIME SHIFTS
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.overtime_shifts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view open shifts
CREATE POLICY "ot_shifts_read" ON public.overtime_shifts
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admin/management/dispatcher can create and manage
CREATE POLICY "ot_shifts_write" ON public.overtime_shifts
  FOR ALL USING (has_role(ARRAY['admin','management','dispatcher']))
  WITH CHECK (has_role(ARRAY['admin','management','dispatcher']));

-- ══════════════════════════════════════════════════════════════════════════════
-- OVERTIME BIDS
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.overtime_bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ot_bids_own" ON public.overtime_bids
  FOR ALL USING (employee_id = get_my_employee_id())
  WITH CHECK (employee_id = get_my_employee_id());

CREATE POLICY "ot_bids_admin" ON public.overtime_bids
  FOR ALL USING (has_role(ARRAY['admin','management','dispatcher']))
  WITH CHECK (has_role(ARRAY['admin','management','dispatcher']));

-- ══════════════════════════════════════════════════════════════════════════════
-- OVERTIME AWARDS
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.overtime_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ot_awards_own" ON public.overtime_awards
  FOR SELECT USING (employee_id = get_my_employee_id());

CREATE POLICY "ot_awards_admin" ON public.overtime_awards
  FOR ALL USING (has_role(ARRAY['admin','management','dispatcher']))
  WITH CHECK (has_role(ARRAY['admin','management','dispatcher']));

-- ══════════════════════════════════════════════════════════════════════════════
-- OFF-DAY REQUESTS
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.off_day_requests ENABLE ROW LEVEL SECURITY;

-- Employee can view and respond to their own requests
CREATE POLICY "off_day_own" ON public.off_day_requests
  FOR ALL USING (employee_id = get_my_employee_id())
  WITH CHECK (employee_id = get_my_employee_id());

-- Dispatcher/admin/management can create and view all
CREATE POLICY "off_day_dispatcher" ON public.off_day_requests
  FOR ALL USING (has_role(ARRAY['admin','management','dispatcher']))
  WITH CHECK (has_role(ARRAY['admin','management','dispatcher']));

-- ══════════════════════════════════════════════════════════════════════════════
-- OT BANNER (public-ish — all authenticated users can read)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.ot_banner ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ot_banner_read" ON public.ot_banner
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "ot_banner_write" ON public.ot_banner
  FOR ALL USING (has_role(ARRAY['admin','management','dispatcher']))
  WITH CHECK (has_role(ARRAY['admin','management','dispatcher']));

-- ══════════════════════════════════════════════════════════════════════════════
-- FORM SUBMISSIONS
-- CRITICAL: employees CANNOT see other employees' submissions
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- Employee can see only their own submissions; can update ONLY if status='returned'
CREATE POLICY "forms_own_select" ON public.form_submissions
  FOR SELECT USING (employee_id = get_my_employee_id());

CREATE POLICY "forms_own_insert" ON public.form_submissions
  FOR INSERT WITH CHECK (employee_id = get_my_employee_id());

CREATE POLICY "forms_own_update_returned" ON public.form_submissions
  FOR UPDATE USING (
    employee_id = get_my_employee_id()
    AND status = 'returned'
  );

-- Management/admin: full access to all forms
CREATE POLICY "forms_admin_all" ON public.form_submissions
  FOR ALL USING (has_role(ARRAY['admin','management']))
  WITH CHECK (has_role(ARRAY['admin','management']));

-- ══════════════════════════════════════════════════════════════════════════════
-- FORM ACKNOWLEDGEMENTS
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.form_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "form_acks_own" ON public.form_acknowledgements
  FOR ALL USING (employee_id = get_my_employee_id())
  WITH CHECK (employee_id = get_my_employee_id());

CREATE POLICY "form_acks_admin" ON public.form_acknowledgements
  FOR SELECT USING (has_role(ARRAY['admin','management']));

-- ══════════════════════════════════════════════════════════════════════════════
-- SAFETY MEETINGS
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.safety_meetings ENABLE ROW LEVEL SECURITY;

-- All authenticated employees can view meetings
CREATE POLICY "safety_meetings_read" ON public.safety_meetings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admin creates/manages meetings
CREATE POLICY "safety_meetings_admin" ON public.safety_meetings
  FOR ALL USING (has_role(ARRAY['admin','management']))
  WITH CHECK (has_role(ARRAY['admin','management']));

-- ══════════════════════════════════════════════════════════════════════════════
-- SAFETY MEETING SIGN-INS
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.safety_meeting_signins ENABLE ROW LEVEL SECURITY;

-- Employee can sign themselves in and view own sign-ins
CREATE POLICY "safety_signins_own" ON public.safety_meeting_signins
  FOR ALL USING (employee_id = get_my_employee_id())
  WITH CHECK (employee_id = get_my_employee_id());

-- Supervisors/coordinators/admin can view all sign-ins
CREATE POLICY "safety_signins_read_mgmt" ON public.safety_meeting_signins
  FOR SELECT USING (has_role(ARRAY['admin','management','supervisor','coordinator']));

-- Admin can INSERT/UPDATE (manual attendance corrections)
CREATE POLICY "safety_signins_admin_write" ON public.safety_meeting_signins
  FOR ALL USING (has_role(ARRAY['admin','management']))
  WITH CHECK (has_role(ARRAY['admin','management']));

-- ══════════════════════════════════════════════════════════════════════════════
-- NOTIFICATIONS
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "notifications_own" ON public.notifications
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════════════════
-- COUNTING SHEET REVISIONS
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.counting_sheet_revisions ENABLE ROW LEVEL SECURITY;

-- Admin/management/dispatcher can view revisions
CREATE POLICY "sheet_revisions_read" ON public.counting_sheet_revisions
  FOR SELECT USING (has_role(ARRAY['admin','management','dispatcher']));

-- Admin/management/dispatcher can create revisions
CREATE POLICY "sheet_revisions_write" ON public.counting_sheet_revisions
  FOR INSERT WITH CHECK (has_role(ARRAY['admin','management','dispatcher']));
