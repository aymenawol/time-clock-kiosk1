-- V2 Phase 12: Durable login rate limiting
-- Date: 2026-06-16
--
-- The login action's in-memory limiter (a module-level Map) is per-instance and
-- resets on cold start, so it is ineffective on serverless / multi-instance
-- deploys (e.g. Vercel). This moves the brute-force counter into Postgres so the
-- limit holds across every instance. The action calls register_login_attempt()
-- and gracefully falls back to its in-memory limiter if these objects are absent
-- (so login keeps working even before this migration is deployed).

CREATE TABLE IF NOT EXISTS public.login_attempts (
  attempt_key  TEXT PRIMARY KEY,
  count        INT  NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Internal table: only SECURITY DEFINER functions (run as owner) touch it.
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Atomically bump the attempt counter for a key inside a sliding window.
-- Returns { allowed: bool, retry_after_min?: int }.
CREATE OR REPLACE FUNCTION public.register_login_attempt(
  p_key TEXT, p_max INT, p_window_secs INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now       TIMESTAMPTZ := now();
  v_row       public.login_attempts%ROWTYPE;
  v_retry_min INT;
BEGIN
  SELECT * INTO v_row FROM public.login_attempts WHERE attempt_key = p_key FOR UPDATE;

  -- No record, or the window has expired → start a fresh window.
  IF NOT FOUND OR v_now - v_row.window_start > make_interval(secs => p_window_secs) THEN
    INSERT INTO public.login_attempts (attempt_key, count, window_start, updated_at)
    VALUES (p_key, 1, v_now, v_now)
    ON CONFLICT (attempt_key) DO UPDATE
      SET count = 1, window_start = v_now, updated_at = v_now;
    RETURN jsonb_build_object('allowed', true);
  END IF;

  -- Within the window and already at the cap → deny.
  IF v_row.count >= p_max THEN
    v_retry_min := CEIL(
      EXTRACT(EPOCH FROM (make_interval(secs => p_window_secs) - (v_now - v_row.window_start))) / 60.0
    );
    RETURN jsonb_build_object('allowed', false, 'retry_after_min', GREATEST(v_retry_min, 1));
  END IF;

  UPDATE public.login_attempts SET count = count + 1, updated_at = v_now WHERE attempt_key = p_key;
  RETURN jsonb_build_object('allowed', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_login_attempts(p_key TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.login_attempts WHERE attempt_key = p_key;
$$;

GRANT EXECUTE ON FUNCTION public.register_login_attempt(TEXT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_login_attempts(TEXT) TO service_role;
