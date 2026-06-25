'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function redirectByRole(role: string | undefined, router: ReturnType<typeof useRouter>) {
  if (!role) { router.replace('/login'); return }
  if (role === 'admin' || role === 'management') { router.replace('/admin/employees'); return }
  if (role === 'coordinator' || role === 'supervisor') { router.replace('/coordinator'); return }
  if (role === 'dispatcher') { router.replace('/dispatcher'); return }
  if (role === 'technician') { router.replace('/technician'); return }
  if (role === 'fueler_washer') { router.replace('/fueler'); return }
  if (role === 'payroll') { router.replace('/admin/payroll'); return }
  router.replace('/driver')
}

export default function OnboardPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
      setUserName(user.user_metadata?.name ?? null)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }

    setLoading(true)
    setError(null)

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    redirectByRole(user?.app_metadata?.role as string | undefined, router)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/rolecall-logo.svg" alt="Rolecall" className="size-16 rounded-2xl" />
          </div>
          <h1 className="text-foreground text-2xl font-bold">
            Welcome{userName ? `, ${userName.split(' ')[0]}` : ''}!
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Set your password to complete your Rolecall account
          </p>
        </div>

        <Card className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="onboard-password">New Password</Label>
              <Input
                id="onboard-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Minimum 8 characters"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="onboard-confirm">Confirm Password</Label>
              <Input
                id="onboard-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="Repeat password"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-danger-surface border border-danger-border px-4 py-3 text-danger text-sm">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} size="lg" className="w-full">
              {loading ? 'Setting up…' : 'Set Password & Continue'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
