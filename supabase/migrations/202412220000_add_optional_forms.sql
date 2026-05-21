-- Migration: Add tables for optional driver forms
-- Date: 2024-12-22

-- ==================== INCIDENT REPORTS TABLE ====================
CREATE TABLE IF NOT EXISTS incident_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  employee_name TEXT NOT NULL,
  incident_date DATE NOT NULL,
  incident_time TEXT NOT NULL,
  incident_location TEXT NOT NULL,
  bus_number TEXT,
  supervisor_contacted TEXT,
  details TEXT NOT NULL,
  witnesses TEXT,
  passenger_name TEXT,
  passenger_address TEXT,
  passenger_city_state_zip TEXT,
  passenger_phone TEXT,
  date_completed DATE NOT NULL,
  time_completed TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== TIME OFF REQUESTS TABLE ====================
CREATE TABLE IF NOT EXISTS time_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  employee_name TEXT NOT NULL,
  mailbox_number TEXT,
  start_time TEXT,
  submission_date DATE NOT NULL,
  dates_requested DATE[] NOT NULL DEFAULT '{}',
  request_type TEXT NOT NULL DEFAULT 'vacation_pto' CHECK (request_type IN ('vacation_pto', 'bereavement', 'birthday', 'jury_duty')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  days_available BOOLEAN[] DEFAULT '{}',
  operations_manager_signature TEXT,
  approved BOOLEAN[] DEFAULT '{}',
  vacation_time_available TEXT,
  vacation_time_used TEXT,
  vacation_time_left TEXT,
  pto_time_available TEXT,
  pto_time_used TEXT,
  pto_time_left TEXT,
  birthday_time_available TEXT,
  birthday_time_used TEXT,
  birthday_time_left TEXT,
  unpaid_time TEXT,
  payroll_signature TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== OVERTIME REQUESTS TABLE ====================
CREATE TABLE IF NOT EXISTS overtime_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  employee_name TEXT NOT NULL,
  seniority_number TEXT,
  time_stamp TIMESTAMP WITH TIME ZONE,
  date_submitted DATE NOT NULL,
  shift_number TEXT,
  shift_date DATE,
  start_time TEXT,
  end_time TEXT,
  pay_hours TEXT,
  dispatcher_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'awarded', 'not_awarded')),
  manager_signature TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== FMLA CONVERSION REQUESTS TABLE ====================
CREATE TABLE IF NOT EXISTS fmla_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  employee_name TEXT NOT NULL,
  mailbox_number TEXT,
  submission_date DATE NOT NULL,
  dates_to_convert DATE[] NOT NULL DEFAULT '{}',
  use_vacation_pay BOOLEAN[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  fmla_approved BOOLEAN[] DEFAULT '{}',
  reason_for_disapproval TEXT,
  entered_by TEXT,
  approved_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_incident_reports_employee ON incident_reports(employee_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_date ON incident_reports(incident_date);
CREATE INDEX IF NOT EXISTS idx_incident_reports_status ON incident_reports(status);

CREATE INDEX IF NOT EXISTS idx_time_off_requests_employee ON time_off_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_date ON time_off_requests(submission_date);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_status ON time_off_requests(status);

CREATE INDEX IF NOT EXISTS idx_overtime_requests_employee ON overtime_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_overtime_requests_date ON overtime_requests(date_submitted);
CREATE INDEX IF NOT EXISTS idx_overtime_requests_status ON overtime_requests(status);

CREATE INDEX IF NOT EXISTS idx_fmla_conversions_employee ON fmla_conversions(employee_id);
CREATE INDEX IF NOT EXISTS idx_fmla_conversions_date ON fmla_conversions(submission_date);
CREATE INDEX IF NOT EXISTS idx_fmla_conversions_status ON fmla_conversions(status);

-- ==================== ROW LEVEL SECURITY ====================
ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE fmla_conversions ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (adjust as needed for your security requirements)
CREATE POLICY "Allow all for incident_reports" ON incident_reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for time_off_requests" ON time_off_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for overtime_requests" ON overtime_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for fmla_conversions" ON fmla_conversions FOR ALL USING (true) WITH CHECK (true);

-- ==================== ENABLE REALTIME ====================
-- Enable realtime for notifications on all form tables
ALTER PUBLICATION supabase_realtime ADD TABLE incident_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE time_off_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE overtime_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE fmla_conversions;
