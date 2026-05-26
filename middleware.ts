import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Routes that require a valid Supabase session and specific roles.
 * Admin routes: admin, management
 * Everything else is handled by page-level guards.
 */
const ADMIN_ROLES = ['admin', 'management']
const DISPATCHER_ROLES = ['admin', 'management', 'dispatcher']
const DRIVER_ROLES = ['admin', 'management', 'driver']
const COORDINATOR_ROLES = ['admin', 'management', 'coordinator', 'supervisor']
const TECHNICIAN_ROLES = ['admin', 'management', 'technician']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — must be done on every middleware call
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── Protect /admin/* routes ──────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!user) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(loginUrl)
    }
    const role = (user.app_metadata?.role as string) ?? null
    if (!role || !ADMIN_ROLES.includes(role)) {
      const u = request.nextUrl.clone(); u.pathname = '/unauthorized'
      return NextResponse.redirect(u)
    }
  }

  // ── Protect /dispatcher/* routes ─────────────────────────────────────────
  if (pathname.startsWith('/dispatcher')) {
    if (!user) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(loginUrl)
    }
    const role = (user.app_metadata?.role as string) ?? null
    if (!role || !DISPATCHER_ROLES.includes(role)) {
      const u = request.nextUrl.clone(); u.pathname = '/unauthorized'
      return NextResponse.redirect(u)
    }
  }

  // ── Protect /driver/* routes ──────────────────────────────────────────────
  if (pathname.startsWith('/driver')) {
    if (!user) {
      const u = request.nextUrl.clone()
      u.pathname = '/'
      return NextResponse.redirect(u)
    }
    const role = (user.app_metadata?.role as string) ?? null
    if (!role || !DRIVER_ROLES.includes(role)) {
      const u = request.nextUrl.clone(); u.pathname = '/unauthorized'
      return NextResponse.redirect(u)
    }
  }

  // ── Protect /coordinator/* routes ─────────────────────────────────────────
  if (pathname.startsWith('/coordinator')) {
    if (!user) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(loginUrl)
    }
    const role = (user.app_metadata?.role as string) ?? null
    if (!role || !COORDINATOR_ROLES.includes(role)) {
      const u = request.nextUrl.clone(); u.pathname = '/unauthorized'
      return NextResponse.redirect(u)
    }
  }

  // ── Protect /technician/* routes ──────────────────────────────────────────
  if (pathname.startsWith('/technician')) {
    if (!user) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(loginUrl)
    }
    const role = (user.app_metadata?.role as string) ?? null
    if (!role || !TECHNICIAN_ROLES.includes(role)) {
      const u = request.nextUrl.clone(); u.pathname = '/unauthorized'
      return NextResponse.redirect(u)
    }
  }

  // ── Redirect authenticated admin/management away from /login ─────────────
  if (pathname === '/login' && user) {
    const role = (user.app_metadata?.role as string) ?? null
    if (role && ADMIN_ROLES.includes(role)) {
      const adminUrl = request.nextUrl.clone()
      adminUrl.pathname = '/admin/employees'
      return NextResponse.redirect(adminUrl)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static / _next/image (Next.js internals)
     * - favicon.ico
     * - public image assets
     * - the Supabase safety share route (public, token-based, no auth needed)
     */
    '/((?!_next/static|_next/image|favicon.ico|images/|safety/).*)',
  ],
}
