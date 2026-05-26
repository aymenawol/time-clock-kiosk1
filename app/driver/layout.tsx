import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import DriverShell from '@/components/driver-shell'

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getServerUser()
  if (!user) redirect('/')

  const role = (user.app_metadata?.role as string) ?? ''
  if (!['admin', 'management', 'driver'].includes(role)) redirect('/unauthorized')

  // Look up employee id + check for motion lock exemption
  const supabase = await createSupabaseServerClient()
  const { data: emp } = await supabase
    .from('employees')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  const employeeId = emp?.id ?? user.id

  // Check active motion lock override for this employee
  let isMotionLockExempt = false
  if (emp?.id) {
    const { data: override } = await supabase
      .from('session_overrides')
      .select('id')
      .eq('employee_id', emp.id)
      .eq('override_type', 'motion_lock_exempt')
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
    isMotionLockExempt = !!override
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-gray-900 border-b border-gray-800 px-4 h-12 flex items-center gap-5">
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
        <Link href="/driver/10-51" className="text-sm text-orange-400 hover:text-orange-300 font-semibold transition-colors">
          10-51
        </Link>
        <Link href="/driver/lost-found" className="text-sm text-gray-400 hover:text-white transition-colors">
          Lost & Found
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
        <Link href="/driver/performance" className="text-sm text-gray-400 hover:text-white transition-colors">
          Performance
        </Link>
        <div className="ml-auto flex items-center gap-4">
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-xs text-gray-500 hover:text-gray-300">Sign out</button>
          </form>
        </div>
      </nav>
      <DriverShell employeeId={employeeId} isMotionLockExempt={isMotionLockExempt}>
        <main className="px-4 py-5 max-w-2xl mx-auto">{children}</main>
      </DriverShell>
    </div>
  )
}
