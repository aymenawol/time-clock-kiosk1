import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase-server'

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getServerUser()
  if (!user) redirect('/')

  const role = (user.app_metadata?.role as string) ?? ''
  if (!['admin', 'management', 'driver'].includes(role)) redirect('/unauthorized')

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-gray-900 border-b border-gray-800 px-4 h-12 flex items-center gap-6">
        <Link href="/driver" className="font-bold text-sm text-white/90">My Dashboard</Link>
        <Link href="/driver/counting-sheet" className="text-sm text-gray-400 hover:text-white transition-colors">
          Counting Sheet
        </Link>
        <Link href="/driver/inspection/pre_trip" className="text-sm text-gray-400 hover:text-white transition-colors">
          Pre-Trip
        </Link>
        <Link href="/driver/inspection/post_trip" className="text-sm text-gray-400 hover:text-white transition-colors">
          Post-Trip
        </Link>
        <Link href="/driver/bids" className="text-sm text-gray-400 hover:text-white transition-colors">
          Bids
        </Link>
        <Link href="/driver/overtime" className="text-sm text-gray-400 hover:text-white transition-colors">
          Overtime
        </Link>
        <Link href="/driver/forms" className="text-sm text-gray-400 hover:text-white transition-colors">
          Forms
        </Link>
        <Link href="/driver/safety-meetings" className="text-sm text-gray-400 hover:text-white transition-colors">
          Safety
        </Link>
        <div className="ml-auto flex items-center gap-4">
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-xs text-gray-500 hover:text-gray-300">Sign out</button>
          </form>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
