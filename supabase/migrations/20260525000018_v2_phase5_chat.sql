-- Phase 5: Internal Secure Chat System

CREATE TABLE IF NOT EXISTS chat_rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('direct','group','department','emergency')),
  department  TEXT,
  created_by  UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  is_active   BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS chat_room_members (
  room_id     UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (room_id, employee_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id               UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id             UUID REFERENCES employees(id) ON DELETE SET NULL,
  content               TEXT NOT NULL,
  message_type          TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','emergency_alert')),
  requires_confirmation BOOLEAN DEFAULT false,
  sent_at               TIMESTAMPTZ DEFAULT now(),
  is_deleted            BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS chat_deliveries (
  message_id   UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (message_id, recipient_id)
);

CREATE TABLE IF NOT EXISTS chat_reads (
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  reader_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  read_at    TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (message_id, reader_id)
);

CREATE TABLE IF NOT EXISTS chat_confirmations (
  message_id   UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  confirmer_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  confirmed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (message_id, confirmer_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_sent ON chat_messages(room_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender    ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_members_emp   ON chat_room_members(employee_id);
CREATE INDEX IF NOT EXISTS idx_chat_confirmations_msg  ON chat_confirmations(message_id);

-- Seed department rooms (idempotent)
INSERT INTO chat_rooms (name, type, department) VALUES
  ('Dispatch',    'department', 'dispatch'),
  ('Supervisors', 'department', 'supervisors'),
  ('Management',  'department', 'management'),
  ('Admin',       'department', 'admin'),
  ('Emergency',   'emergency',  NULL)
ON CONFLICT DO NOTHING;

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_confirmations;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_rooms;
