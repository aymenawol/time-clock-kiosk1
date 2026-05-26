-- Phase 6: Gap fixes
-- end_of_shift_submissions table + repairs storage bucket

-- ==================== END OF SHIFT SUBMISSIONS ====================

CREATE TABLE IF NOT EXISTS public.end_of_shift_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id        UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  bus_id          UUID REFERENCES public.buses(id) ON DELETE SET NULL,
  employee_id     UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  bus_type        TEXT,
  fuel_level_pct  NUMERIC(5,2),  -- for EV: battery %; for diesel: % equivalent
  fuel_label      TEXT,           -- 'Full', 'Over 3/4', 'Over 1/2', 'Under 1/4'
  ev_battery_pct  NUMERIC(5,2),  -- EV raw %
  status_submitted TEXT NOT NULL DEFAULT 'ready'
                  CHECK (status_submitted IN ('ready','charge_required','shop','hazard')),
  notes           TEXT,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eos_shift    ON public.end_of_shift_submissions(shift_id);
CREATE INDEX IF NOT EXISTS idx_eos_bus      ON public.end_of_shift_submissions(bus_id);
CREATE INDEX IF NOT EXISTS idx_eos_date     ON public.end_of_shift_submissions(submitted_at DESC);

ALTER TABLE public.end_of_shift_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eos_driver_insert" ON public.end_of_shift_submissions
  FOR INSERT WITH CHECK (
    public.get_my_employee_id() IS NOT NULL
  );

CREATE POLICY "eos_driver_read_own" ON public.end_of_shift_submissions
  FOR SELECT USING (
    employee_id = public.get_my_employee_id()
    OR public.has_role(ARRAY['admin','management','dispatcher','supervisor','coordinator'])
  );

CREATE POLICY "eos_admin_all" ON public.end_of_shift_submissions
  FOR ALL USING (
    public.has_role(ARRAY['admin','management'])
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.end_of_shift_submissions;

-- ==================== REPAIRS STORAGE BUCKET ====================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'repairs',
  'repairs',
  false,
  10485760,  -- 10 MB per file
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload repair photos
CREATE POLICY "repairs_upload" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'repairs');

-- Allow technicians and admins to read repair photos
CREATE POLICY "repairs_read" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'repairs');

-- Allow admins to delete repair photos
CREATE POLICY "repairs_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'repairs'
    AND (auth.jwt() ->> 'role') IN ('admin', 'management', 'technician')
  );
