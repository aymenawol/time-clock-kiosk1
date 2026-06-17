'use server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * N1 — Hybrid login.
 *
 * Drivers / kiosk operators sign in with their 4-digit Employee ID + password.
 * The Employee ID → email mapping is resolved server-side (never exposed to the
 * browser) using the service-role client, then handed to Supabase Auth's
 * email/password sign-in. Attempts are rate-limited per Employee ID to blunt
 * brute-force / enumeration.
 *
 * Staff (office) continue to sign in with email + password directly on the
 * client; that path is unchanged.
 */

export type EmployeeLoginResult =
  | { ok: true; role: string | null }
  | { ok: false; error: string }

// ── Rate limiting (durable, DB-backed, with in-memory fallback) ─────────────
// Brute-force counter lives in Postgres (register_login_attempt RPC) so the cap
// holds across every serverless instance. If the RPC is unavailable (e.g. the
// migration is not yet deployed), we degrade to a per-instance in-memory window
// so login still works and is never left completely unprotected.
const MAX_ATTEMPTS = 5
const WINDOW_SECS = 15 * 60 // 15 minutes
const WINDOW_MS = WINDOW_SECS * 1000
const attempts = new Map<string, { count: number; first: number }>()

function checkRateLimitMemory(key: string): { allowed: boolean; retryAfterMin?: number } {
  const now = Date.now()
  const rec = attempts.get(key)
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now })
    return { allowed: true }
  }
  if (rec.count >= MAX_ATTEMPTS) {
    const retryAfterMin = Math.ceil((WINDOW_MS - (now - rec.first)) / 60000)
    return { allowed: false, retryAfterMin }
  }
  rec.count += 1
  return { allowed: true }
}

async function checkRateLimit(
  admin: ReturnType<typeof createSupabaseAdmin>,
  key: string
): Promise<{ allowed: boolean; retryAfterMin?: number }> {
  const { data, error } = await admin.rpc('register_login_attempt', {
    p_key: key,
    p_max: MAX_ATTEMPTS,
    p_window_secs: WINDOW_SECS,
  })
  if (error) return checkRateLimitMemory(key) // RPC missing / DB hiccup → fall back
  const res = data as { allowed: boolean; retry_after_min?: number }
  return { allowed: res.allowed, retryAfterMin: res.retry_after_min }
}

async function clearRateLimit(admin: ReturnType<typeof createSupabaseAdmin>, key: string) {
  attempts.delete(key)
  await admin.rpc('clear_login_attempts', { p_key: key }).then(undefined, () => {})
}

const GENERIC_ERROR = 'Invalid Employee ID or password.'

export async function signInWithEmployeeId(
  employeeId: string,
  password: string
): Promise<EmployeeLoginResult> {
  const id = (employeeId ?? '').trim()

  // Format guard — Employee IDs are short numeric codes.
  if (!/^\d{3,8}$/.test(id)) {
    return { ok: false, error: 'Enter your numeric Employee ID.' }
  }
  if (!password) {
    return { ok: false, error: 'Enter your password.' }
  }

  // RLS-bypassing admin client — also backs the durable rate limiter.
  const admin = createSupabaseAdmin()

  const rl = await checkRateLimit(admin, id)
  if (!rl.allowed) {
    return {
      ok: false,
      error: `Too many attempts. Try again in ${rl.retryAfterMin} minute${
        rl.retryAfterMin === 1 ? '' : 's'
      }, or sign in with your email.`,
    }
  }

  // Resolve Employee ID → email server-side.
  const { data: employee, error: lookupError } = await admin
    .from('employees')
    .select('email, status')
    .eq('employee_id', id)
    .maybeSingle()

  if (lookupError) {
    return { ok: false, error: 'Sign-in is temporarily unavailable. Please try again.' }
  }

  // Don't leak whether the ID exists — same generic error either way.
  if (!employee?.email) {
    return { ok: false, error: GENERIC_ERROR }
  }
  if (employee.status === 'terminated') {
    return { ok: false, error: 'This account is inactive. Contact your administrator.' }
  }

  // Sign in via the cookie-bound server client so the session is established.
  const supabase = await createSupabaseServerClient()
  const { data, error: authError } = await supabase.auth.signInWithPassword({
    email: employee.email,
    password,
  })

  if (authError || !data.user) {
    return { ok: false, error: GENERIC_ERROR }
  }

  const role = (data.user.app_metadata?.role as string | undefined) ?? null
  if (!role) {
    await supabase.auth.signOut()
    return {
      ok: false,
      error: 'Your account does not have an assigned role. Contact your administrator.',
    }
  }

  await clearRateLimit(admin, id)
  return { ok: true, role }
}
