-- Phase 4: Driver Fatigue Monitoring
CREATE TABLE IF NOT EXISTS fatigue_alerts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  alert_type        TEXT NOT NULL CHECK (alert_type IN ('single_shift','consecutive_days','ot_threshold')),
  -- context fields (nullable depending on type)
  shift_id          UUID REFERENCES shifts(id) ON DELETE SET NULL,
  shift_hours       DECIMAL(5,2),   -- hours worked that triggered single_shift alert
  consecutive_count INT,            -- number of consecutive days that triggered consecutive_days alert
  weekly_ot_hours   DECIMAL(5,2),   -- OT hours that triggered ot_threshold alert
  triggered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- resolution (by supervisor/management/admin)
  resolved_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at       TIMESTAMPTZ,
  notes             TEXT,
  -- mid-shift dismissal (by dispatcher)
  dismissed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dismissed_at      TIMESTAMPTZ,
  dismiss_reason    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fatigue_alerts_employee     ON fatigue_alerts(employee_id);
CREATE INDEX IF NOT EXISTS idx_fatigue_alerts_unresolved   ON fatigue_alerts(employee_id) WHERE resolved_at IS NULL AND dismissed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fatigue_alerts_triggered_at ON fatigue_alerts(triggered_at DESC);

-- Enable Realtime for live alert feed on dispatch board
ALTER PUBLICATION supabase_realtime ADD TABLE fatigue_alerts;
