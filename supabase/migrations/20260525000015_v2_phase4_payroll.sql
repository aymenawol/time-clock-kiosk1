-- Phase 4: Payroll Module
-- pay_periods: bi-weekly pay periods managed by admin/payroll
CREATE TABLE IF NOT EXISTS pay_periods (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start   DATE NOT NULL,
  period_end     DATE NOT NULL,
  pay_date       DATE,
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pay_periods_date_range_check CHECK (period_end > period_start),
  UNIQUE(period_start, period_end)
);

-- daily_hours_records: one row per employee per work day
-- Populated by calculatePayPeriodHours server action triggered on period close / on-demand
CREATE TABLE IF NOT EXISTS daily_hours_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  pay_period_id    UUID REFERENCES pay_periods(id) ON DELETE CASCADE,
  work_date        DATE NOT NULL,
  shift_id         UUID REFERENCES shifts(id) ON DELETE SET NULL,
  clock_in         TIMESTAMPTZ,
  clock_out        TIMESTAMPTZ,
  regular_hours    DECIMAL(5,2) NOT NULL DEFAULT 0,
  overtime_hours   DECIMAL(5,2) NOT NULL DEFAULT 0,
  pto_hours        DECIMAL(5,2) NOT NULL DEFAULT 0,
  fmla_hours       DECIMAL(5,2) NOT NULL DEFAULT 0,
  missed_breaks    INT NOT NULL DEFAULT 0,
  total_paid_hours DECIMAL(5,2) GENERATED ALWAYS AS (regular_hours + overtime_hours + pto_hours + fmla_hours) STORED,
  is_incomplete    BOOLEAN NOT NULL DEFAULT false,   -- true if no clock_out found
  audit_log        JSONB NOT NULL DEFAULT '[]',       -- corrections appended here
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_hours_employee_date   ON daily_hours_records(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_daily_hours_pay_period      ON daily_hours_records(pay_period_id);

-- payroll_exports: audit trail of CSV export events
CREATE TABLE IF NOT EXISTS payroll_exports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_period_id  UUID NOT NULL REFERENCES pay_periods(id) ON DELETE CASCADE,
  exported_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  exported_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  row_count      INT NOT NULL DEFAULT 0
);

-- Auto-update updated_at on daily_hours_records
CREATE OR REPLACE FUNCTION update_daily_hours_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_daily_hours_updated_at ON daily_hours_records;
CREATE TRIGGER trg_daily_hours_updated_at
  BEFORE UPDATE ON daily_hours_records
  FOR EACH ROW EXECUTE FUNCTION update_daily_hours_updated_at();
