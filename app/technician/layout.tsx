import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase-server'
import Link from 'next/link'
import SignOutButton from '@/components/sign-out-button'
import NotificationBell from '@/components/notification-bell'
import { ThemeToggle } from '@/components/theme-toggle'

const TECHNICIAN_ROLES = ['admin', 'management', 'technician']

export default async function TechnicianLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getServerUser()
  if (!user) redirect('/')

  const role: string = user.app_metadata?.role ?? ''
  if (!TECHNICIAN_ROLES.includes(role)) redirect('/unauthorized')

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-foreground text-sm">Technician</span>
          <Link href="/technician" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Open Defects
          </Link>
        </div>
        <div className="flex items-center gap-2">
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
