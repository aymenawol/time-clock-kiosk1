import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase-server'
import SignOutButton from '@/components/sign-out-button'

export default async function DispatcherLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getServerUser()
  if (!user) redirect('/login?redirectTo=/dispatcher')

  const role = (user.app_metadata?.role as string) ?? ''
  if (!['admin', 'management', 'dispatcher'].includes(role)) redirect('/unauthorized')

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-gray-900 border-b border-gray-800 px-4 h-12 flex items-center gap-1 overflow-x-auto scrollbar-hide">
        <Link href="/dispatcher" className="font-bold text-sm text-white/90 whitespace-nowrap px-2 py-1">Dispatch Console</Link>
        <Link href="/dispatcher" className="text-sm text-gray-400 hover:text-white transition-colors whitespace-nowrap px-2 py-1 rounded-lg">
          Dashboard
        </Link>
        <Link href="/dispatcher/sign-in" className="text-sm text-gray-400 hover:text-white transition-colors whitespace-nowrap px-2 py-1 rounded-lg">
          Sign-In Sheet
        </Link>
        <Link href="/dispatcher/overtime" className="text-sm text-gray-400 hover:text-white transition-colors whitespace-nowrap px-2 py-1 rounded-lg">
          Overtime
        </Link>
        <Link href="/board" className="text-sm text-yellow-500 hover:text-yellow-300 transition-colors font-semibold whitespace-nowrap px-2 py-1 rounded-lg">
          Dispatch Board ↗
        </Link>
        <Link href="/chat" className="text-sm text-blue-400 hover:text-blue-300 transition-colors font-semibold whitespace-nowrap px-2 py-1 rounded-lg">
          Chat
        </Link>
        <div className="ml-auto pl-4 flex-shrink-0">
          <SignOutButton />
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
