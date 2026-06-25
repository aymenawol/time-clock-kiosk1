"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { Delete, ShieldCheck, Bus, Clock3 } from "lucide-react"
import { signInWithEmployeeId } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

type AppRouter = ReturnType<typeof useRouter>

/**
 * Accept only same-origin relative paths as a post-login redirect target.
 * Rejects absolute and protocol-relative URLs to prevent open redirects.
 */
function safeInternalPath(raw: string | null, fallback: string): string {
  if (!raw || !raw.startsWith('/')) return fallback
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  return raw
}

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
  const redirectTo = safeInternalPath(searchParams.get("redirectTo"), "/admin/employees")

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

  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel — desktop only */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex xl:w-[55%]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(60rem 60rem at 15% 10%, rgba(255,255,255,0.25), transparent 55%), radial-gradient(50rem 50rem at 90% 90%, rgba(0,0,0,0.25), transparent 50%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/rolecall-logo.svg" alt="Rolecall" className="size-10 rounded-xl" />
          <span className="text-lg font-bold tracking-tight">Rolecall</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
            Run every shift from one place.
          </h1>
          <p className="mt-4 text-base text-primary-foreground/80">
            Sign-ins, breaks, inspections, GPS, payroll and more — the whole
            operation, live and in sync.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-primary-foreground/90">
            <li className="flex items-center gap-3">
              <Bus className="size-5 shrink-0" /> Real-time fleet & driver status
            </li>
            <li className="flex items-center gap-3">
              <Clock3 className="size-5 shrink-0" /> Breaks, overtime & payroll, automated
            </li>
            <li className="flex items-center gap-3">
              <ShieldCheck className="size-5 shrink-0" /> Inspections, safety & compliance
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          Harry Reid International Airport · Las Vegas
        </p>
      </aside>

      {/* Sign-in panel */}
      <main className="flex w-full flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm">
          {/* Compact brand for mobile */}
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/rolecall-logo.svg" alt="Rolecall" className="size-14 rounded-2xl" />
            <h1 className="mt-4 text-2xl font-bold text-foreground">Rolecall</h1>
          </div>

          <div className="mb-6 hidden lg:block">
            <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to continue.</p>
          </div>

          {/* Mode toggle */}
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(["kiosk", "staff"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m)
                  setError(null)
                }}
                className={cn(
                  "rounded-lg py-2.5 text-sm font-semibold transition-colors",
                  mode === m
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m === "kiosk" ? "Employee ID" : "Staff Email"}
              </button>
            ))}
          </div>

          {mode === "kiosk" ? (
            <form onSubmit={handleKioskSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="employeeId">Employee ID</Label>
                <Input
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
                  className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
                />
              </div>

              {/* On-screen keypad for touch kiosks */}
              <div className="grid grid-cols-3 gap-2">
                {keypadKeys.map((k) => (
                  <Button
                    key={k}
                    type="button"
                    variant={k === "clear" || k === "del" ? "secondary" : "outline"}
                    size="xl"
                    onClick={() => pressKey(k)}
                    className="select-none font-semibold"
                  >
                    {k === "del" ? <Delete className="size-5" /> : k === "clear" ? "C" : k}
                  </Button>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="kioskPassword">Password</Label>
                <Input
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
                />
              </div>

              {error && <ErrorBanner>{error}</ErrorBanner>}

              <Button type="submit" size="lg" disabled={loading} className="w-full">
                {loading ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleStaffSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {error && <ErrorBanner>{error}</ErrorBanner>}

              <Button type="submit" size="lg" disabled={loading} className="w-full">
                {loading ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Trouble signing in? Contact your administrator.
          </p>
        </div>
      </main>
    </div>
  )
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-danger-border bg-danger-surface px-4 py-3 text-sm text-danger"
    >
      {children}
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
