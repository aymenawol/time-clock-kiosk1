-- V2 Phase 1: Auth Foundation
-- Creates: profiles table, role helpers, custom JWT hook, settings stubs
-- Date: 2026-05-20

-- ==================== PROFILES TABLE ====================

CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id  TEXT    REFERENCES public.employees(employee_id) ON DELETE SET NULL,
  role         TEXT    NOT NULL CHECK (role IN (
                 'admin','management','driver','dispatcher',
                 'coordinator','supervisor','technician','fueler_washer','payroll'
               )),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_employee_id ON public.profiles(employee_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role        ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active   ON public.profiles(is_active);

-- ==================== UPDATED_AT TRIGGER ====================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==================== ROLE HELPER FUNCTIONS ====================

-- Returns the role of the current authenticated user (from profiles)
-- Used as a fallback when JWT claims are not yet configured
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- ==================== CUSTOM ACCESS TOKEN HOOK ====================
-- This function injects the user's role into the JWT as a custom claim.
-- After running this migration, enable it in the Supabase Dashboard:
--   Authentication > Hooks > Custom Access Token Hook
--   Schema: public  Function: custom_access_token_hook

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims   JSONB;
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = (event ->> 'user_id')::UUID;

  claims := event -> 'claims';

  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant execute to Supabase auth admin only
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- ==================== SETTINGS STUB TABLES ====================

-- Single-row config table for break rules, overtime rules, notification prefs
-- Phase 2 and 4 will read from these columns rather than hardcode values.

CREATE TABLE IF NOT EXISTS public.app_settings (
  id                        TEXT    PRIMARY KEY DEFAULT 'singleton',
  break_rules               JSONB   NOT NULL DEFAULT '{
    "default_break_duration_minutes": 30,
    "break_window_start_hours": 3.5,
    "break_window_end_hours": 5.0,
    "missed_break_alert_minutes": 15,
    "allow_dispatcher_override": true
  }'::JSONB,
  overtime_rules            JSONB   NOT NULL DEFAULT '{
    "daily_ot_threshold_hours": 8,
    "weekly_ot_threshold_hours": 40,
    "ot_multiplier": 1.5,
    "award_method": "seniority",
    "bid_cycle_months": 4
  }'::JSONB,
  notification_preferences  JSONB   NOT NULL DEFAULT '{
    "roles_notified_on_clock_in":  ["admin", "dispatcher"],
    "roles_notified_on_incident":  ["admin", "management", "coordinator"],
    "roles_notified_on_time_off":  ["admin", "management", "payroll"],
    "roles_notified_on_overtime":  ["admin", "management", "dispatcher"],
    "roles_notified_on_fmla":      ["admin", "management", "payroll"]
  }'::JSONB,
  created_at                TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT singleton_check CHECK (id = 'singleton')
);

DROP TRIGGER IF EXISTS set_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER set_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed the singleton row
INSERT INTO public.app_settings (id)
VALUES ('singleton')
ON CONFLICT (id) DO NOTHING;

-- ==================== RLS: PROFILES ====================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Every user can read their own profile
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'profiles: own read'
  ) THEN
    CREATE POLICY "profiles: own read" ON public.profiles
      FOR SELECT
      USING (id = auth.uid());
  END IF;

  -- Admins/management have full access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'profiles: admin full access'
  ) THEN
    CREATE POLICY "profiles: admin full access" ON public.profiles
      FOR ALL
      USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'management')
      );
  END IF;
END;
$$;

-- ==================== RLS: APP_SETTINGS ====================

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_settings'
      AND policyname = 'app_settings: authenticated read'
  ) THEN
    CREATE POLICY "app_settings: authenticated read" ON public.app_settings
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_settings'
      AND policyname = 'app_settings: admin write'
  ) THEN
    CREATE POLICY "app_settings: admin write" ON public.app_settings
      FOR ALL
      USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'management')
      );
  END IF;
END;
$$;
