import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase-server'
import Link from 'next/link'
import SignOutButton from '@/components/sign-out-button'
import NotificationBell from '@/components/notification-bell'
import { ThemeToggle } from '@/components/theme-toggle'

const FUELER_ROLES = ['admin', 'management', 'fueler_washer']

export default async function FuelerLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getServerUser()
  if (!user) redirect('/')

  const role: string = user.app_metadata?.role ?? ''
  if (!FUELER_ROLES.includes(role)) redirect('/unauthorized')

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-foreground text-sm">Fueler / Washer</span>
          <Link href="/fueler" className="text-sm text-muted-foreground hover:text-foreground">Dashboard</Link>
          <Link href="/driver/forms" className="text-sm text-muted-foreground hover:text-foreground">Forms</Link>
          <Link href="/driver/safety-meetings" className="text-sm text-muted-foreground hover:text-foreground">Safety Meetings</Link>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <NotificationBell />
          <SignOutButton />
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
