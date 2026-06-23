import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'

/**
 * Creates a Supabase client for use in Server Components, Server Actions,
 * and Route Handlers. Uses the user's session cookie.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll can throw in Server Components (read-only context).
            // Session refresh is handled by middleware.
          }
        },
      },
    }
  )
}

/**
 * Validates the session against Supabase Auth and returns the user (or null).
 *
 * `supabase.auth.getUser()` is a NETWORK round-trip to the Auth server, and it
 * used to fire independently in the role layout, the page, and every guard —
 * 2–3+ sequential auth calls per navigation. React `cache()` memoizes the result
 * for the lifetime of a single server render, so the layout + page + guards in
 * one request now share ONE round-trip. (Server Actions are separate requests
 * and get their own cached entry, deduped within that action.)
 */
const getCachedUser = cache(
  async (): Promise<import('@supabase/supabase-js').User | null> => {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  }
)

/**
 * Returns the currently authenticated user from the session, or null.
 * Always returns { user } so callers can destructure: const { user } = await getServerUser()
 * Safe to call from Server Components. Deduped per-request (see getCachedUser).
 */
export async function getServerUser(): Promise<{ user: import('@supabase/supabase-js').User | null }> {
  return { user: await getCachedUser() }
}

/**
 * Returns the role stored in app_metadata for the current user.
 * Requires the admin API to have set app_metadata.role when the account was created.
 */
export async function getServerUserRole(): Promise<string | null> {
  const { user } = await getServerUser()
  if (!user) return null
  return (user.app_metadata?.role as string) ?? null
}

/**
 * Bundle of identity fields the app shell needs for its header/user menu:
 * the auth user, role, display name (from the employees roster), and email.
 * One round-trip; safe to call from any role layout.
 */
export const getShellUser = cache(async (): Promise<{
  user: import('@supabase/supabase-js').User | null
  role: string | null
  name: string | null
  email: string | null
}> => {
  const user = await getCachedUser()
  if (!user) return { user: null, role: null, name: null, email: null }

  const role = (user.app_metadata?.role as string) ?? null
  const supabase = await createSupabaseServerClient()
  const { data: emp } = await supabase
    .from('employees')
    .select('name')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  return { user, role, name: emp?.name ?? null, email: user.email ?? null }
})
