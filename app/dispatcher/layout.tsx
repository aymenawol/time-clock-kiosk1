import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase-server'
import SignOutButton from '@/components/sign-out-button'
import NotificationBell from '@/components/notification-bell'
import { ThemeToggle } from '@/components/theme-toggle'

export default async function DispatcherLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getServerUser()
  if (!user) redirect('/login?redirectTo=/dispatcher')

  const role = (user.app_metadata?.role as string) ?? ''
  if (!['admin', 'management', 'dispatcher'].includes(role)) redirect('/unauthorized')

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="bg-card border-b border-border px-4 h-12 flex items-center gap-1 overflow-x-auto scrollbar-hide">
        <Link href="/dispatcher" className="font-bold text-sm text-foreground/90 whitespace-nowrap px-2 py-1">Dispatch Console</Link>
        <Link href="/dispatcher" className="text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap px-2 py-1 rounded-lg">
          Dashboard
        </Link>
        <Link href="/dispatcher/sign-in" className="text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap px-2 py-1 rounded-lg">
          Sign-In Sheet
        </Link>
        <Link href="/dispatcher/overtime" className="text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap px-2 py-1 rounded-lg">
          Overtime
        </Link>
        <Link href="/board" className="text-sm text-yellow-500 hover:text-yellow-300 transition-colors font-semibold whitespace-nowrap px-2 py-1 rounded-lg">
          Dispatch Board ↗
        </Link>
        <Link href="/chat" className="text-sm text-blue-400 hover:text-blue-300 transition-colors font-semibold whitespace-nowrap px-2 py-1 rounded-lg">
          Chat
        </Link>
        <div className="ml-auto pl-4 flex-shrink-0 flex items-center gap-2">
          <ThemeToggle />
          <NotificationBell />
          <SignOutButton />
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
