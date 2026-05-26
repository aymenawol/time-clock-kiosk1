import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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
 * Returns the currently authenticated user from the session, or null.
 * Always returns { user } so callers can destructure: const { user } = await getServerUser()
 * Safe to call from Server Components.
 */
export async function getServerUser(): Promise<{ user: import('@supabase/supabase-js').User | null }> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { user }
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
