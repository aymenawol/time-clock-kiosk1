import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase-server'

export default async function DispatcherLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getServerUser()
  if (!user) redirect('/login?redirectTo=/dispatcher')

  const role = (user.app_metadata?.role as string) ?? ''
  if (!['admin', 'management', 'dispatcher'].includes(role)) redirect('/unauthorized')

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-gray-900 border-b border-gray-800 px-4 h-12 flex items-center gap-6">
        <span className="font-bold text-sm text-white/90">Dispatch Console</span>
        <Link href="/dispatcher" className="text-sm text-gray-400 hover:text-white transition-colors">
          Dashboard
        </Link>
        <Link href="/dispatcher/sign-in" className="text-sm text-gray-400 hover:text-white transition-colors">
          Sign-In Sheet
        </Link>
        <Link href="/admin/buses" className="text-sm text-gray-400 hover:text-white transition-colors">
          Fleet
        </Link>
        <Link href="/dispatcher/overtime" className="text-sm text-gray-400 hover:text-white transition-colors">
          Overtime
        </Link>
        <Link href="/admin/map" className="text-sm text-gray-400 hover:text-white transition-colors">
          Live Map
        </Link>
        <Link href="/board" className="text-sm text-yellow-500 hover:text-yellow-300 transition-colors font-semibold">
          Dispatch Board ↗
        </Link>
        <Link href="/chat" className="text-sm text-blue-400 hover:text-blue-300 transition-colors font-semibold">
          Chat
        </Link>
        <Link href="/admin/lost-found" className="text-sm text-gray-400 hover:text-white transition-colors">
          Lost & Found
        </Link>
        <div className="ml-auto flex items-center gap-4">
          <span className="text-xs text-gray-600">{role}</span>
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-xs text-gray-500 hover:text-gray-300">Sign out</button>
          </form>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
