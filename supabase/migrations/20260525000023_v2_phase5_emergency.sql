-- Phase 5: Emergency Operations Mode

CREATE TABLE IF NOT EXISTS emergency_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by  UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  triggered_at  TIMESTAMPTZ DEFAULT now(),
  event_type    TEXT NOT NULL CHECK (event_type IN ('weather','airport_emergency','reroute','custom')),
  message       TEXT NOT NULL,
  resolved_by   UUID REFERENCES employees(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ,
  is_active     BOOLEAN NOT NULL DEFAULT true
);

-- Enforce only one active emergency at a time via partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_emergency_one_active
  ON emergency_events (is_active)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS emergency_acknowledgements (
  event_id      UUID NOT NULL REFERENCES emergency_events(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (event_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_emergency_acks_event ON emergency_acknowledgements(event_id);

-- Enable Realtime for live push to driver tablets and admin dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE emergency_events;
ALTER PUBLICATION supabase_realtime ADD TABLE emergency_acknowledgements;
