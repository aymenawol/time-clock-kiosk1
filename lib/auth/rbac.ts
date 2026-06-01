import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { User } from '@supabase/supabase-js'
import type { EmployeeRole } from '@/lib/supabase'

/**
 * Shared authorization guards for Server Actions.
 *
 * Every Server Action that touches the service-role (admin) client — which
 * bypasses RLS — MUST call requireUser()/requireRole() as its first statement.
 * Returns a discriminated result so callers can short-circuit with their own
 * return shape:  const auth = await requireRole('admin'); if (!auth.ok) return { error: auth.error }
 */

export type AuthOk = { ok: true; user: User; role: EmployeeRole | null }
export type AuthFail = { ok: false; error: string; status: 401 | 403 }
export type AuthResult = AuthOk | AuthFail

/** Require an authenticated session. Role may be null. */
export async function requireUser(): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'You must be signed in.', status: 401 }
  const role = (user.app_metadata?.role as EmployeeRole | undefined) ?? null
  return { ok: true, user, role }
}

/** Require an authenticated session whose role is one of `roles`. */
export async function requireRole(...roles: EmployeeRole[]): Promise<AuthResult> {
  const res = await requireUser()
  if (!res.ok) return res
  if (!res.role || !roles.includes(res.role)) {
    return { ok: false, error: 'You do not have permission to perform this action.', status: 403 }
  }
  return res
}
