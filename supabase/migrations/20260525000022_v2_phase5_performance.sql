-- Phase 5: Driver Performance Snapshots

CREATE TABLE IF NOT EXISTS driver_performance_snapshots (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id                 UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  snapshot_date               DATE NOT NULL,
  shift_id                    UUID REFERENCES shifts(id) ON DELETE SET NULL,
  attendance_status           TEXT NOT NULL DEFAULT 'present'
                                CHECK (attendance_status IN ('present','absent','late','excused')),
  missed_breaks_count         INTEGER NOT NULL DEFAULT 0,
  safety_meetings_attended    INTEGER NOT NULL DEFAULT 0,
  safety_meetings_missed      INTEGER NOT NULL DEFAULT 0,
  inspections_completed       INTEGER NOT NULL DEFAULT 0,
  inspections_missed          INTEGER NOT NULL DEFAULT 0,
  counting_sheets_submitted   INTEGER NOT NULL DEFAULT 0,
  counting_sheets_missed      INTEGER NOT NULL DEFAULT 0,
  ot_bids_submitted           INTEGER NOT NULL DEFAULT 0,
  ot_awarded                  INTEGER NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (employee_id, snapshot_date, shift_id)
);

CREATE INDEX IF NOT EXISTS idx_perf_snapshots_emp  ON driver_performance_snapshots(employee_id);
CREATE INDEX IF NOT EXISTS idx_perf_snapshots_date ON driver_performance_snapshots(snapshot_date DESC);
