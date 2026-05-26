-- V2 Phase 3: Digital Forms
-- Date: 2026-05-25

-- ── Form Submissions ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.form_submissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  form_type         TEXT NOT NULL
                      CHECK (form_type IN (
                        'time_off',
                        'bid_vacation_change',
                        'incident_report',
                        'fmla_conversion',
                        'resignation'
                      )),
  version           INTEGER NOT NULL DEFAULT 1,
  -- All form data stored in JSONB payload; structure varies by form_type
  payload           JSONB NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'submitted'
                      CHECK (status IN ('submitted','under_review','approved','denied','returned')),
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  reviewer_comments TEXT,
  -- Points to the original submission when this is a resubmission after return
  parent_id         UUID REFERENCES public.form_submissions(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Form Acknowledgements (employee confirms receipt of decision) ─────────────

CREATE TABLE IF NOT EXISTS public.form_acknowledgements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  UUID NOT NULL REFERENCES public.form_submissions(id) ON DELETE CASCADE,
  employee_id    UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (submission_id, employee_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_form_subs_employee   ON public.form_submissions(employee_id);
CREATE INDEX IF NOT EXISTS idx_form_subs_type       ON public.form_submissions(form_type);
CREATE INDEX IF NOT EXISTS idx_form_subs_status     ON public.form_submissions(status);
CREATE INDEX IF NOT EXISTS idx_form_subs_submitted  ON public.form_submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_form_acks_submission ON public.form_acknowledgements(submission_id);

-- ── Triggers ──────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_form_subs_updated_at ON public.form_submissions;
CREATE TRIGGER set_form_subs_updated_at
  BEFORE UPDATE ON public.form_submissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
