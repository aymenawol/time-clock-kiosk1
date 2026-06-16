-- V2 Phase 10: Remove the dead custom_access_token_hook.
-- Date: 2026-06-01
--
-- The hook injected a top-level `user_role` claim that NOTHING reads — every
-- guard and all RLS read app_metadata.role (set server-side by the admin API,
-- non-spoofable). Leaving the hook is misleading and a latent footgun.
--
-- ⚠️ DB-HOLDER: Before applying, confirm in Supabase Dashboard →
--    Authentication → Hooks that "Custom Access Token" is DISABLED (it should
--    be — the app never depended on it). If it is enabled, disable it first,
--    otherwise dropping the function will break token issuance / login.

DROP FUNCTION IF EXISTS public.custom_access_token_hook(jsonb);
