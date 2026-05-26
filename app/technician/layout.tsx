import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase-server'
import Link from 'next/link'

const TECHNICIAN_ROLES = ['admin', 'management', 'technician']

export default async function TechnicianLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getServerUser()
  if (!user) redirect('/')

  const role: string = user.app_metadata?.role ?? ''
  if (!TECHNICIAN_ROLES.includes(role)) redirect('/unauthorized')

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-white text-sm">Technician</span>
          <Link href="/technician" className="text-sm text-gray-400 hover:text-white transition-colors">
            Open Defects
          </Link>
          <Link href="/admin/buses" className="text-sm text-gray-400 hover:text-white transition-colors">
            Fleet
          </Link>
        </div>
        <form action="/api/auth/signout" method="post">
          <button type="submit" className="text-xs text-gray-500 hover:text-gray-300">Sign out</button>
        </form>
      </nav>
      <main className="max-w-4xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
