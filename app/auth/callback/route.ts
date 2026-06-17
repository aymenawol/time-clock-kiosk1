import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Only allow same-origin, single-leading-slash relative paths as redirect
 * targets. Rejects absolute URLs and protocol-relative (`//host`, `/\host`)
 * payloads so the post-auth redirect can never be steered off-origin.
 */
function safeNext(raw: string | null): string {
  const fallback = '/onboard'
  if (!raw) return fallback
  if (!raw.startsWith('/')) return fallback        // reject absolute URLs
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback // reject protocol-relative
  return raw
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=invalid_invite`)
}
