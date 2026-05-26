import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase-server'

const BOARD_ROLES = ['admin', 'management', 'dispatcher', 'supervisor']

export default async function BoardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getServerUser()
  if (!user) redirect('/login?redirectTo=/board')

  const role = (user.app_metadata?.role as string) ?? ''
  if (!BOARD_ROLES.includes(role)) redirect('/unauthorized')

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-hidden">
      {children}
    </div>
  )
}
