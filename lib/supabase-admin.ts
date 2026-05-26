import { createClient } from '@supabase/supabase-js'

/**
 * Supabase admin client using the service role key.
 * NEVER expose this to the browser — only use in Server Actions or Route Handlers.
 * Used for: creating auth users, updating app_metadata, banning accounts, etc.
 */
export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.'
    )
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
