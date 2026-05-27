"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"

type AppRouter = ReturnType<typeof useRouter>

function redirectByRole(role: string | undefined, adminRedirectTo: string, router: AppRouter) {
  if (!role) return
  if (role === "admin" || role === "management") { router.replace(adminRedirectTo); return }
  if (role === "coordinator" || role === "supervisor") { router.replace("/coordinator"); return }
  if (role === "dispatcher") { router.replace("/dispatcher"); return }
  if (role === "technician") { router.replace("/technician"); return }
  if (role === "fueler_washer") { router.replace("/fueler"); return }
  if (role === "payroll") { router.replace("/admin/payroll"); return }
  // drivers: no routing here — they use the kiosk screen
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirectTo") ?? "/admin/employees"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // If already logged in redirect to the appropriate dashboard
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const role = user.app_metadata?.role as string | undefined
        redirectByRole(role, redirectTo, router)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !data.user) {
      setError(authError?.message ?? "Login failed. Please check your credentials.")
      setLoading(false)
      return
    }

    const role = data.user.app_metadata?.role as string | undefined

    // Blocked accounts (terminated/banned)
    if (!role) {
      await supabase.auth.signOut()
      setError("Your account does not have an assigned role. Contact your administrator.")
      setLoading(false)
      return
    }

    redirectByRole(role, redirectTo, router)

    // Drivers shouldn't log in from this portal
    if (role === "driver") {
      await supabase.auth.signOut()
      setError("Driver login is available from the main kiosk screen.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ backgroundColor: "#E31E24" }}
          >
            <span className="text-white text-2xl font-bold">TC</span>
          </div>
          <h1 className="text-white text-2xl font-bold">Time Clock</h1>
          <p className="text-gray-400 text-sm mt-1">Staff Login</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-300 mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@transdev.com"
                className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent transition"
                style={{ "--tw-ring-color": "#E31E24" } as React.CSSProperties}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-300 mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent transition"
                style={{ "--tw-ring-color": "#E31E24" } as React.CSSProperties}
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-950 border border-red-800 px-4 py-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 rounded-xl font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ backgroundColor: "#E31E24" }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-600">
            Driver? Log in from the{" "}
            <a href="/" className="text-gray-400 underline underline-offset-2">
              kiosk screen
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
