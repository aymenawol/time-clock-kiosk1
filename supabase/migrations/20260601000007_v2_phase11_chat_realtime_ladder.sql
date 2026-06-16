-- V2 Phase 11 (N10): publish chat delivery/read tables for the live status
-- ladder (Sent → Delivered → Read → Confirmed) in the chat client.
-- Date: 2026-06-03
-- Guarded so re-running is a no-op (the unguarded ADD TABLE pattern errors if
-- the table is already a publication member).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_deliveries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_deliveries;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_reads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reads;
  END IF;
END;
$$;
