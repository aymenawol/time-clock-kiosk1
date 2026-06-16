-- V2 Phase 11 (N12): coordinator/supervisor OK/X compliance verdict on shifts.
-- The coordinator reviews each completed shift and records an OK (compliant) or
-- X (flagged) verdict with an optional note. Restricted-scope roles
-- (coordinator/supervisor) get exactly this monitor capability — no fleet writes.
-- Date: 2026-06-03

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS compliance_verdict TEXT
    CHECK (compliance_verdict IN ('ok', 'flag')),
  ADD COLUMN IF NOT EXISTS compliance_note    TEXT,
  ADD COLUMN IF NOT EXISTS compliance_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS compliance_at      TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_shifts_compliance_verdict
  ON public.shifts(compliance_verdict) WHERE compliance_verdict IS NOT NULL;
