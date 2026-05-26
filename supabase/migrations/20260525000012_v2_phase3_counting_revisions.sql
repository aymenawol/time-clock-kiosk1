-- V2 Phase 3: Counting Sheet Corrections & Revision History
-- Date: 2026-05-25

-- Add correction-tracking columns to counting_sheets
ALTER TABLE public.counting_sheets
  ADD COLUMN IF NOT EXISTS locked_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS correction_note TEXT;

-- ── Revision History ──────────────────────────────────────────────────────────
-- Every time a dispatcher/admin edits a submitted (locked) counting sheet,
-- the before-state is saved here for audit trail.

CREATE TABLE IF NOT EXISTS public.counting_sheet_revisions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id       UUID NOT NULL REFERENCES public.counting_sheets(id) ON DELETE CASCADE,
  revised_by     UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  revised_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  previous_rows  JSONB NOT NULL DEFAULT '[]',
  new_rows       JSONB NOT NULL DEFAULT '[]',
  reason         TEXT
);

CREATE INDEX IF NOT EXISTS idx_sheet_revisions_sheet ON public.counting_sheet_revisions(sheet_id);
CREATE INDEX IF NOT EXISTS idx_sheet_revisions_user  ON public.counting_sheet_revisions(revised_by);
