-- V2 Perf: missing index coverage on hot foreign-key / filter paths.
-- Date: 2026-06-22
--
-- ⛔ APPLY + VERIFY IS DELEGATED TO THE DB AGENT.
--    These statements were authored from the schema in supabase/migrations/*
--    but have NOT been applied to or EXPLAIN-verified against the live database.
--    Before shipping: run `supabase db push`, then `EXPLAIN ANALYZE` the queries
--    noted below to confirm the planner uses each index.
--
-- All statements are additive and idempotent (CREATE INDEX IF NOT EXISTS) — safe
-- to re-run. On large tables the DB agent may prefer to run these as
-- `CREATE INDEX CONCURRENTLY` OUTSIDE a migration transaction to avoid a write
-- lock; the IF NOT EXISTS form here is the simple, transaction-safe default.

-- ── shifts.tablet_id ─────────────────────────────────────────────────────────
-- FK to tablets, previously unindexed. Dispatcher loads join shifts↔tablets and
-- the end-of-shift flow frees a tablet by shift; both scan shifts without this.
CREATE INDEX IF NOT EXISTS idx_shifts_tablet_id
  ON public.shifts (tablet_id);

-- ── breaks.dispatcher_override_by ────────────────────────────────────────────
-- FK to auth.users, previously unindexed. Admin/override audit lookups scan breaks.
CREATE INDEX IF NOT EXISTS idx_breaks_dispatcher_override_by
  ON public.breaks (dispatcher_override_by);

-- ── repair_notes.technician_id ───────────────────────────────────────────────
-- FK to auth.users, previously unindexed. Technician dashboards filter by tech.
CREATE INDEX IF NOT EXISTS idx_repair_notes_technician_id
  ON public.repair_notes (technician_id);

-- ── chat receipts: recipient/reader leading lookups ──────────────────────────
-- chat_deliveries PK is (message_id, recipient_id) and chat_reads PK is
-- (message_id, reader_id); a per-user lookup ("my deliveries / reads") cannot use
-- those PK indexes because the user column is not leading. markReadAction /
-- markDeliveredAction and receipt fan-out hit these.
CREATE INDEX IF NOT EXISTS idx_chat_deliveries_recipient
  ON public.chat_deliveries (recipient_id);
CREATE INDEX IF NOT EXISTS idx_chat_reads_reader
  ON public.chat_reads (reader_id);

-- ── employees: fatigue-alert fan-out predicate ──────────────────────────────
-- fn_fatigue_alert_notify() (AFTER INSERT on fatigue_alerts) selects active
-- dispatchers/supervisors/management on every alert; without this it sequential-
-- scans employees per insert. Partial index matches the trigger predicate exactly.
CREATE INDEX IF NOT EXISTS idx_employees_active_notify
  ON public.employees (role)
  WHERE status = 'active' AND auth_user_id IS NOT NULL;
