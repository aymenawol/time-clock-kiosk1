-- Phase 5: Lost & Found Module

-- Storage bucket for photos (created via Supabase dashboard or Storage API; migration seeds config)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lost-and-found',
  'lost-and-found',
  false,
  10485760,  -- 10 MB per file
  ARRAY['image/jpeg','image/png','image/heic','image/heif']
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS lost_items (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id                 UUID REFERENCES buses(id) ON DELETE SET NULL,
  reported_by            UUID REFERENCES employees(id) ON DELETE SET NULL,
  item_description       TEXT NOT NULL,
  location_found         TEXT NOT NULL,
  is_bag                 BOOLEAN DEFAULT false,
  bag_contents           TEXT,
  status                 TEXT NOT NULL DEFAULT 'found'
                           CHECK (status IN ('found','collected','returned_to_dispatch','claimed','disposed')),
  found_at               TIMESTAMPTZ DEFAULT now(),
  collected_by           UUID REFERENCES employees(id) ON DELETE SET NULL,
  collected_at           TIMESTAMPTZ,
  returned_to_dispatch_at TIMESTAMPTZ,
  claimed_at             TIMESTAMPTZ,
  claimant_name          TEXT,
  claimant_id            TEXT,
  disposed_at            TIMESTAMPTZ,
  disposal_reason        TEXT,
  photo_paths            TEXT[] DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS lost_item_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID NOT NULL REFERENCES lost_items(id) ON DELETE CASCADE,
  old_status  TEXT,
  new_status  TEXT NOT NULL,
  changed_by  UUID REFERENCES employees(id) ON DELETE SET NULL,
  changed_at  TIMESTAMPTZ DEFAULT now(),
  notes       TEXT
);

CREATE INDEX IF NOT EXISTS idx_lost_items_status     ON lost_items(status);
CREATE INDEX IF NOT EXISTS idx_lost_items_reported   ON lost_items(reported_by);
CREATE INDEX IF NOT EXISTS idx_lost_items_found_at   ON lost_items(found_at DESC);
CREATE INDEX IF NOT EXISTS idx_lost_item_history_item ON lost_item_status_history(item_id);

-- Trigger: auto-log status history on status change
CREATE OR REPLACE FUNCTION log_lost_item_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO lost_item_status_history (item_id, old_status, new_status)
    VALUES (NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lost_item_status ON lost_items;
CREATE TRIGGER trg_lost_item_status
  AFTER UPDATE OF status ON lost_items
  FOR EACH ROW EXECUTE FUNCTION log_lost_item_status_change();
