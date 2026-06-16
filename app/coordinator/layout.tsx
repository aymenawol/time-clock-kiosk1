import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase-server'
import Link from 'next/link'
import SignOutButton from '@/components/sign-out-button'
import NotificationBell from '@/components/notification-bell'
import { ThemeToggle } from '@/components/theme-toggle'

const COORDINATOR_ROLES = ['admin', 'management', 'coordinator', 'supervisor']

export default async function CoordinatorLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getServerUser()
  if (!user) redirect('/')

  const role: string = user.app_metadata?.role ?? ''
  if (!COORDINATOR_ROLES.includes(role)) redirect('/unauthorized')

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-foreground text-sm">Coordinator View</span>
          <Link href="/coordinator" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Overview
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-600 bg-muted px-2 py-1 rounded">Read-only</span>
          <ThemeToggle />
          <NotificationBell />
          <SignOutButton />
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
