-- Phase 5: Wheelchair Assistance (10-51) Module

CREATE TABLE IF NOT EXISTS airlines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL UNIQUE,
  terminal            TEXT,
  phone               TEXT,
  wheelchair_contact  TEXT,
  notes               TEXT,
  is_active           BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS wheelchair_requests (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id                       UUID REFERENCES employees(id) ON DELETE SET NULL,
  bus_id                          UUID REFERENCES buses(id) ON DELETE SET NULL,
  passenger_name                  TEXT NOT NULL,
  airline_id                      UUID REFERENCES airlines(id) ON DELETE SET NULL,
  flight_number                   TEXT,
  submitted_at                    TIMESTAMPTZ DEFAULT now(),
  status                          TEXT NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending','acknowledged','resolved','escalated')),
  dispatcher_response             TEXT,
  responded_at                    TIMESTAMPTZ,
  escalated_at                    TIMESTAMPTZ,
  closed_without_response_reason  TEXT
);

CREATE INDEX IF NOT EXISTS idx_wheelchair_status      ON wheelchair_requests(status);
CREATE INDEX IF NOT EXISTS idx_wheelchair_driver      ON wheelchair_requests(driver_id);
CREATE INDEX IF NOT EXISTS idx_wheelchair_submitted   ON wheelchair_requests(submitted_at DESC);

-- Enable Realtime for dispatcher notifications
ALTER PUBLICATION supabase_realtime ADD TABLE wheelchair_requests;

-- Seed Harry Reid International Airport carriers
INSERT INTO airlines (name, terminal, phone, wheelchair_contact, notes) VALUES
  ('Southwest Airlines',  'Terminal 1',        '1-800-435-9792', NULL, 'Main carrier at T1'),
  ('Delta Air Lines',     'Terminal 1',        '1-800-221-1212', NULL, NULL),
  ('American Airlines',   'Terminal 1',        '1-800-433-7300', NULL, NULL),
  ('United Airlines',     'Terminal 3',        '1-800-864-8331', NULL, NULL),
  ('Spirit Airlines',     'Terminal 1',        '1-800-772-7117', NULL, NULL),
  ('Frontier Airlines',   'Terminal 1',        '1-801-401-9000', NULL, NULL),
  ('Alaska Airlines',     'Terminal 1',        '1-800-252-7522', NULL, NULL),
  ('JetBlue Airways',     'Terminal 3',        '1-800-538-2583', NULL, NULL),
  ('Hawaiian Airlines',   'Terminal 3',        '1-800-367-5320', NULL, NULL),
  ('Korean Air',          'Terminal 3',        '1-800-438-5000', NULL, 'International'),
  ('British Airways',     'Terminal 3',        '1-800-247-9297', NULL, 'International'),
  ('Air Canada',          'Terminal 3',        '1-888-247-2262', NULL, 'International'),
  ('WestJet',             'Terminal 3',        '1-888-937-8538', NULL, 'International'),
  ('Allegiant Air',       'Terminal 1',        '1-702-505-8888', NULL, NULL),
  ('Avelo Airlines',      'Terminal 1',        '1-346-616-9500', NULL, NULL),
  ('Sun Country Airlines','Terminal 1',        '1-651-905-2737', NULL, NULL)
ON CONFLICT (name) DO NOTHING;
