"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { signInWithEmployeeId } from "./actions"

type AppRouter = ReturnType<typeof useRouter>

function roleHomePath(role: string | undefined, adminRedirectTo: string): string | null {
  if (!role) return null
  if (role === "admin" || role === "management") return adminRedirectTo
  if (role === "coordinator" || role === "supervisor") return "/coordinator"
  if (role === "dispatcher") return "/dispatcher"
  if (role === "technician") return "/technician"
  if (role === "fueler_washer") return "/fueler"
  if (role === "payroll") return "/admin/payroll"
  if (role === "driver") return "/driver"
  return null
}

function redirectByRole(role: string | undefined, adminRedirectTo: string, router: AppRouter) {
  const path = roleHomePath(role, adminRedirectTo)
  if (path) router.replace(path)
}

type Mode = "kiosk" | "staff"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirectTo") ?? "/admin/employees"

  const [mode, setMode] = useState<Mode>("kiosk")
  const [employeeId, setEmployeeId] = useState("")
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

  const handleStaffSubmit = async (e: React.FormEvent) => {
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

    if (!role) {
      await supabase.auth.signOut()
      setError("Your account does not have an assigned role. Contact your administrator.")
      setLoading(false)
      return
    }

    redirectByRole(role, redirectTo, router)
  }

  const handleKioskSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await signInWithEmployeeId(employeeId, password)

    if (!result.ok) {
      setError(result.error)
      setLoading(false)
      return
    }

    // The server action set the session cookie; refresh so the client picks it
    // up, then navigate to the role's home.
    const path = roleHomePath(result.role ?? undefined, redirectTo)
    router.refresh()
    if (path) router.replace(path)
    else setLoading(false)
  }

  const keypadKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "del"]
  const pressKey = (k: string) => {
    setError(null)
    if (k === "clear") return setEmployeeId("")
    if (k === "del") return setEmployeeId((v) => v.slice(0, -1))
    setEmployeeId((v) => (v.length >= 8 ? v : v + k))
  }

  const inputBase =
    "w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent transition"
  const ring = { "--tw-ring-color": "#2563EB" } as React.CSSProperties

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ backgroundColor: "#2563EB" }}
          >
            <span className="text-foreground text-2xl font-bold">RC</span>
          </div>
          <h1 className="text-foreground text-2xl font-bold">Rolecall</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign In</p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl p-8 border border-border shadow-2xl">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-1 mb-6 p-1 rounded-xl bg-muted">
            <button
              type="button"
              onClick={() => {
                setMode("kiosk")
                setError(null)
              }}
              className={`py-2.5 rounded-lg text-sm font-semibold transition ${
                mode === "kiosk" ? "bg-background text-foreground shadow" : "text-muted-foreground"
              }`}
            >
              Employee ID
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("staff")
                setError(null)
              }}
              className={`py-2.5 rounded-lg text-sm font-semibold transition ${
                mode === "staff" ? "bg-background text-foreground shadow" : "text-muted-foreground"
              }`}
            >
              Staff Email
            </button>
          </div>

          {mode === "kiosk" ? (
            <form onSubmit={handleKioskSubmit} className="space-y-5">
              <div>
                <label htmlFor="employeeId" className="block text-sm font-medium text-foreground mb-1.5">
                  Employee ID
                </label>
                <input
                  id="employeeId"
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  autoComplete="username"
                  required
                  value={employeeId}
                  onChange={(e) => {
                    setEmployeeId(e.target.value.replace(/\D/g, "").slice(0, 8))
                    setError(null)
                  }}
                  placeholder="0000"
                  className={`${inputBase} text-center text-2xl tracking-[0.5em] font-mono`}
                  style={ring}
                />
              </div>

              {/* On-screen keypad for touch kiosks */}
              <div className="grid grid-cols-3 gap-2">
                {keypadKeys.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => pressKey(k)}
                    className="py-3 rounded-xl bg-muted border border-border text-foreground text-lg font-semibold active:bg-gray-700 transition select-none"
                  >
                    {k === "del" ? "⌫" : k === "clear" ? "C" : k}
                  </button>
                ))}
              </div>

              <div>
                <label htmlFor="kioskPassword" className="block text-sm font-medium text-foreground mb-1.5">
                  Password
                </label>
                <input
                  id="kioskPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError(null)
                  }}
                  placeholder="••••••••"
                  className={inputBase}
                  style={ring}
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
                className="w-full py-3 px-6 rounded-xl font-semibold text-foreground transition-opacity disabled:opacity-60"
                style={{ backgroundColor: "#2563EB" }}
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleStaffSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputBase}
                  style={ring}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
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
                  className={inputBase}
                  style={ring}
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
                className="w-full py-3 px-6 rounded-xl font-semibold text-foreground transition-opacity disabled:opacity-60"
                style={{ backgroundColor: "#2563EB" }}
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-gray-600">
            Trouble signing in? Contact your administrator.
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
