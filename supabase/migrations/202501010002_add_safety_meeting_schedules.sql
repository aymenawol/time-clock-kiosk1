-- Create safety_meeting_schedules table
CREATE TABLE IF NOT EXISTS safety_meeting_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'SAFETY MEETING SCHEDULES',
  month TEXT NOT NULL,
  year INTEGER NOT NULL,
  instruction TEXT NOT NULL DEFAULT 'Drivers and Coordinators - Please have vests and closed-toe shoes.',
  meetings JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  share_token TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_safety_meeting_schedules_active ON safety_meeting_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_safety_meeting_schedules_share_token ON safety_meeting_schedules(share_token);
CREATE INDEX IF NOT EXISTS idx_safety_meeting_schedules_month_year ON safety_meeting_schedules(month, year);

-- Enable RLS
ALTER TABLE safety_meeting_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow all operations for anonymous users (public access for kiosk app)
CREATE POLICY "Allow public read access" ON safety_meeting_schedules
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON safety_meeting_schedules
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON safety_meeting_schedules
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access" ON safety_meeting_schedules
  FOR DELETE USING (true);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE safety_meeting_schedules;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_safety_meeting_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_safety_meeting_schedules_updated_at ON safety_meeting_schedules;
CREATE TRIGGER trigger_update_safety_meeting_schedules_updated_at
  BEFORE UPDATE ON safety_meeting_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_safety_meeting_schedules_updated_at();

-- Insert sample data (December 2025 schedule from the request)
INSERT INTO safety_meeting_schedules (title, month, year, instruction, meetings, share_token)
VALUES (
  'SAFETY MEETING SCHEDULES',
  'December',
  2025,
  'Drivers and Coordinators - Please have vests and closed-toe shoes.',
  '[
    {"id": "1", "date": "2025-12-15", "time": "13:00", "category": "driver"},
    {"id": "2", "date": "2025-12-15", "time": "15:30", "category": "driver"},
    {"id": "3", "date": "2025-12-16", "time": "17:45", "category": "driver"},
    {"id": "4", "date": "2025-12-16", "time": "19:00", "category": "driver"},
    {"id": "5", "date": "2025-12-18", "time": "10:00", "category": "driver"},
    {"id": "6", "date": "2025-12-18", "time": "13:15", "category": "driver"},
    {"id": "7", "date": "2025-12-19", "time": "10:00", "category": "driver"},
    {"id": "8", "date": "2025-12-19", "time": "15:30", "category": "driver"},
    {"id": "9", "date": "2025-12-16", "time": "10:30", "category": "coordinator"},
    {"id": "10", "date": "2025-12-16", "time": "15:00", "category": "coordinator"},
    {"id": "11", "date": "2025-12-17", "time": "09:45", "category": "coordinator"},
    {"id": "12", "date": "2025-12-17", "time": "12:30", "category": "coordinator"},
    {"id": "13", "date": "2025-12-17", "time": "16:45", "category": "coordinator"},
    {"id": "14", "date": "2025-12-18", "time": "18:45", "category": "coordinator"},
    {"id": "15", "date": "2025-12-17", "time": "14:30", "category": "fueler_washer"},
    {"id": "16", "date": "2025-12-17", "time": "15:30", "category": "technician"}
  ]'::jsonb,
  'dec2025'
)
ON CONFLICT DO NOTHING;
