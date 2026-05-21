-- V2 Phase 1: Employee Schema Expansion
-- Adds full employee profile fields, auth link, balances, and role.
-- Date: 2026-05-20

-- ==================== ADD COLUMNS TO EMPLOYEES ====================

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS auth_user_id     UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS email            TEXT,
  ADD COLUMN IF NOT EXISTS phone            TEXT,
  ADD COLUMN IF NOT EXISTS hire_date        DATE,
  ADD COLUMN IF NOT EXISTS seniority_number INTEGER,
  ADD COLUMN IF NOT EXISTS department       TEXT,
  ADD COLUMN IF NOT EXISTS role             TEXT    CHECK (role IN (
                                              'admin','management','driver','dispatcher',
                                              'coordinator','supervisor','technician',
                                              'fueler_washer','payroll'
                                            )),
  ADD COLUMN IF NOT EXISTS status           TEXT    NOT NULL DEFAULT 'active'
                                              CHECK (status IN ('active','on_leave','terminated')),
  ADD COLUMN IF NOT EXISTS shift            TEXT,
  ADD COLUMN IF NOT EXISTS pto_balance      NUMERIC(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vacation_balance NUMERIC(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fmla_balance     NUMERIC(6,2) NOT NULL DEFAULT 0;

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_employees_auth_user_id    ON public.employees(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_employees_seniority_number ON public.employees(seniority_number);
CREATE INDEX IF NOT EXISTS idx_employees_department       ON public.employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_role             ON public.employees(role);
CREATE INDEX IF NOT EXISTS idx_employees_status           ON public.employees(status);

-- ==================== BACKFILL STATUS FROM IS_ACTIVE ====================

-- Employees that are currently marked inactive are treated as terminated.
-- Active remains 'active'. This can be changed per-employee from the admin UI.
UPDATE public.employees
SET status = 'terminated'
WHERE is_active = FALSE AND status = 'active';

-- ==================== DEPRECATE PIN COLUMN ====================

COMMENT ON COLUMN public.employees.pin IS
  'DEPRECATED in v2: credentials are managed by Supabase Auth. '
  'Retained for backwards-compatibility only; do not use for authentication.';

-- ==================== UNIQUE CONSTRAINT ON AUTH_USER_ID ====================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.employees'::regclass
      AND conname = 'employees_auth_user_id_key'
  ) THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_auth_user_id_key UNIQUE (auth_user_id);
  END IF;
END;
$$;

-- ==================== GET_MY_EMPLOYEE_ID FUNCTION ====================
-- Moved here (from auth_foundation migration) so auth_user_id column exists first.

CREATE OR REPLACE FUNCTION public.get_my_employee_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id
  FROM public.employees e
  WHERE e.auth_user_id = auth.uid()
  LIMIT 1
$$;
