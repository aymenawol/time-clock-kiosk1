-- Phase 5: Motion Safety Lock Session Overrides + Offline Sync Conflicts

CREATE TABLE IF NOT EXISTS session_overrides (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  override_type TEXT NOT NULL DEFAULT 'motion_lock_exempt',
  reason        TEXT NOT NULL,
  shift_id      UUID REFERENCES shifts(id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  is_active     BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_session_overrides_emp     ON session_overrides(employee_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_session_overrides_expires ON session_overrides(expires_at) WHERE is_active = true;

-- Enable Realtime so driver tablet can pick up override in real-time
ALTER PUBLICATION supabase_realtime ADD TABLE session_overrides;

-- Offline sync conflict log
CREATE TABLE IF NOT EXISTS offline_sync_conflicts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID REFERENCES employees(id) ON DELETE SET NULL,
  conflict_type  TEXT NOT NULL,  -- 'counting_sheet', 'inspection', 'status_change', 'break'
  offline_data   JSONB NOT NULL,
  server_data    JSONB,
  resolution     TEXT NOT NULL DEFAULT 'server_wins',
  logged_at      TIMESTAMPTZ DEFAULT now(),
  reviewed_by    UUID REFERENCES employees(id) ON DELETE SET NULL,
  reviewed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_emp    ON offline_sync_conflicts(employee_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_logged ON offline_sync_conflicts(logged_at DESC);
