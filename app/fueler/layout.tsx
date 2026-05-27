import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase-server'
import Link from 'next/link'
import SignOutButton from '@/components/sign-out-button'

const FUELER_ROLES = ['admin', 'management', 'fueler_washer']

export default async function FuelerLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getServerUser()
  if (!user) redirect('/')

  const role: string = user.app_metadata?.role ?? ''
  if (!FUELER_ROLES.includes(role)) redirect('/unauthorized')

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-white text-sm">Fueler / Washer</span>
          <Link href="/fueler" className="text-sm text-gray-400 hover:text-white">Dashboard</Link>
          <Link href="/driver/forms" className="text-sm text-gray-400 hover:text-white">Forms</Link>
          <Link href="/driver/safety-meetings" className="text-sm text-gray-400 hover:text-white">Safety Meetings</Link>
        </div>
        <SignOutButton />
      </nav>
      <main className="max-w-3xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
