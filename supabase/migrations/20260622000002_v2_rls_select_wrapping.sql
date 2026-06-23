-- V2 Perf: RLS helper wrapping to enable initPlan evaluation.
-- Date: 2026-06-22
--
-- Rewrites all public-schema policies in-place by wrapping the following helpers
-- in scalar sub-selects so they are evaluated once per query instead of per row:
--   - auth.uid()
--   - auth.jwt()
--   - public.has_role(...) / has_role(...)
--   - public.get_my_employee_id() / get_my_employee_id()
--   - public.get_my_role() / get_my_role()
--
-- Policy semantics are preserved: same policy names, tables, permissive/restrictive
-- mode, command type, and role targets. Only qual/with_check expressions are changed.

CREATE OR REPLACE FUNCTION public._v2_wrap_rls_helpers(expr text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  out_expr text := expr;
BEGIN
  IF out_expr IS NULL THEN
    RETURN NULL;
  END IF;

  -- Protect already wrapped patterns to avoid double wrapping.
  out_expr := regexp_replace(out_expr, '\(\s*select\s+auth\.uid\(\)\s*\)', '__WRAPPED_AUTH_UID__', 'gi');
  out_expr := regexp_replace(out_expr, '\(\s*select\s+auth\.jwt\(\)\s*\)', '__WRAPPED_AUTH_JWT__', 'gi');
  out_expr := regexp_replace(out_expr, '\(\s*select\s+public\.get_my_employee_id\(\)\s*\)', '__WRAPPED_PUBLIC_GET_MY_EMPLOYEE_ID__', 'gi');
  out_expr := regexp_replace(out_expr, '\(\s*select\s+get_my_employee_id\(\)\s*\)', '__WRAPPED_GET_MY_EMPLOYEE_ID__', 'gi');
  out_expr := regexp_replace(out_expr, '\(\s*select\s+public\.get_my_role\(\)\s*\)', '__WRAPPED_PUBLIC_GET_MY_ROLE__', 'gi');
  out_expr := regexp_replace(out_expr, '\(\s*select\s+get_my_role\(\)\s*\)', '__WRAPPED_GET_MY_ROLE__', 'gi');
  out_expr := regexp_replace(out_expr, '\(\s*select\s+public\.has_role\(([^\)]*)\)\s*\)', '__WRAPPED_PUBLIC_HAS_ROLE__(\1)__END_WRAPPED_PUBLIC_HAS_ROLE__', 'gi');
  out_expr := regexp_replace(out_expr, '\(\s*select\s+has_role\(([^\)]*)\)\s*\)', '__WRAPPED_HAS_ROLE__(\1)__END_WRAPPED_HAS_ROLE__', 'gi');

  -- Apply mechanical wrapping.
  out_expr := regexp_replace(out_expr, '(^|[^[:alnum:]_])auth\.uid\(\)', '\1(SELECT auth.uid())', 'g');
  out_expr := regexp_replace(out_expr, '(^|[^[:alnum:]_])auth\.jwt\(\)', '\1(SELECT auth.jwt())', 'g');
  out_expr := regexp_replace(out_expr, '(^|[^[:alnum:]_])public\.get_my_employee_id\(\)', '\1(SELECT public.get_my_employee_id())', 'g');
  out_expr := regexp_replace(out_expr, '(^|[^[:alnum:]_])get_my_employee_id\(\)', '\1(SELECT get_my_employee_id())', 'g');
  out_expr := regexp_replace(out_expr, '(^|[^[:alnum:]_])public\.get_my_role\(\)', '\1(SELECT public.get_my_role())', 'g');
  out_expr := regexp_replace(out_expr, '(^|[^[:alnum:]_])get_my_role\(\)', '\1(SELECT get_my_role())', 'g');
  out_expr := regexp_replace(out_expr, '(^|[^[:alnum:]_])public\.has_role\(([^\)]*)\)', '\1(SELECT public.has_role(\2))', 'g');
  out_expr := regexp_replace(out_expr, '(^|[^[:alnum:]_])has_role\(([^\)]*)\)', '\1(SELECT has_role(\2))', 'g');

  -- Restore previously wrapped patterns.
  out_expr := replace(out_expr, '__WRAPPED_AUTH_UID__', '(SELECT auth.uid())');
  out_expr := replace(out_expr, '__WRAPPED_AUTH_JWT__', '(SELECT auth.jwt())');
  out_expr := replace(out_expr, '__WRAPPED_PUBLIC_GET_MY_EMPLOYEE_ID__', '(SELECT public.get_my_employee_id())');
  out_expr := replace(out_expr, '__WRAPPED_GET_MY_EMPLOYEE_ID__', '(SELECT get_my_employee_id())');
  out_expr := replace(out_expr, '__WRAPPED_PUBLIC_GET_MY_ROLE__', '(SELECT public.get_my_role())');
  out_expr := replace(out_expr, '__WRAPPED_GET_MY_ROLE__', '(SELECT get_my_role())');
  out_expr := regexp_replace(out_expr, '__WRAPPED_PUBLIC_HAS_ROLE__\(([^\)]*)\)__END_WRAPPED_PUBLIC_HAS_ROLE__', '(SELECT public.has_role(\1))', 'g');
  out_expr := regexp_replace(out_expr, '__WRAPPED_HAS_ROLE__\(([^\)]*)\)__END_WRAPPED_HAS_ROLE__', '(SELECT has_role(\1))', 'g');

  RETURN out_expr;
END;
$$;

DO $$
DECLARE
  pol record;
  new_qual text;
  new_with_check text;
  roles_sql text;
  using_sql text;
  with_check_sql text;
  create_sql text;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  LOOP
    new_qual := public._v2_wrap_rls_helpers(pol.qual);
    new_with_check := public._v2_wrap_rls_helpers(pol.with_check);

    IF COALESCE(new_qual, '') = COALESCE(pol.qual, '')
      AND COALESCE(new_with_check, '') = COALESCE(pol.with_check, '') THEN
      CONTINUE;
    END IF;

    SELECT CASE
      WHEN pol.roles IS NULL OR array_length(pol.roles, 1) IS NULL THEN ''
      ELSE ' TO ' || string_agg(quote_ident(role_name), ', ')
    END
    INTO roles_sql
    FROM unnest(COALESCE(pol.roles, ARRAY[]::name[])) AS role_name;

    roles_sql := COALESCE(roles_sql, '');
    using_sql := CASE WHEN new_qual IS NULL THEN '' ELSE format(' USING (%s)', new_qual) END;
    with_check_sql := CASE WHEN new_with_check IS NULL THEN '' ELSE format(' WITH CHECK (%s)', new_with_check) END;

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);

    create_sql := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s%s%s%s',
      pol.policyname,
      pol.schemaname,
      pol.tablename,
      pol.permissive,
      pol.cmd,
      roles_sql,
      using_sql,
      with_check_sql
    );

    EXECUTE create_sql;
  END LOOP;
END;
$$;

DROP FUNCTION public._v2_wrap_rls_helpers(text);
