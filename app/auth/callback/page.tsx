'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

/**
 * Auth callback — handles BOTH magic-link flows:
 *
 *  1. Implicit flow (admin invites / recovery): Supabase redirects here with the
 *     session in the URL **hash** (`#access_token=…&refresh_token=…&type=invite`).
 *     A server route handler can't read the fragment, so this MUST be a client
 *     page. We call setSession() with the hash tokens.
 *  2. PKCE flow (OAuth / some magic links): session arrives as `?code=…`, which
 *     we exchange with exchangeCodeForSession().
 *
 * After a session is established: invite/recovery → /onboard (set a password);
 * everything else → the user's role home.
 */
function roleHome(role: string | undefined): string {
  if (role === 'admin' || role === 'management') return '/admin/employees'
  if (role === 'coordinator' || role === 'supervisor') return '/coordinator'
  if (role === 'dispatcher') return '/dispatcher'
  if (role === 'technician') return '/technician'
  if (role === 'fueler_washer') return '/fueler'
  if (role === 'payroll') return '/admin/payroll'
  if (role === 'driver') return '/driver'
  return '/'
}

export default function AuthCallbackPage() {
  const router = useRouter()
  const [failed, setFailed] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    ;(async () => {
      const hash = new URLSearchParams(
        typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : ''
      )
      const query = new URLSearchParams(
        typeof window !== 'undefined' ? window.location.search : ''
      )

      const accessToken = hash.get('access_token')
      const refreshToken = hash.get('refresh_token')
      const code = query.get('code')
      const type = hash.get('type') ?? query.get('type') // invite | recovery | magiclink | signup

      let established = false
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        established = !error
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        established = !error
      }

      if (!established) {
        setFailed(true)
        router.replace('/login?error=invalid_invite')
        return
      }

      // Invites and password recovery both need the user to set a password.
      if (type === 'invite' || type === 'recovery') {
        router.replace('/onboard')
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()
      router.replace(roleHome(user?.app_metadata?.role as string | undefined))
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <p className="text-base font-medium text-foreground">
          {failed ? 'This link is invalid or has expired.' : 'Signing you in…'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {failed ? 'Redirecting to login…' : 'One moment.'}
        </p>
      </div>
    </div>
  )
}
