import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import PerformanceClient from '@/app/admin/performance/performance-client'

export const metadata = { title: 'My Performance' }

export default async function DriverPerformancePage() {
  const { user } = await getServerUser()
  if (!user) redirect('/')

  const supabase = await createSupabaseServerClient()

  const { data: emp } = await supabase
    .from('employees')
    .select('id, name, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!emp) redirect('/')

  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: snapshots } = await supabase
    .from('driver_performance_snapshots')
    .select('snapshot_date, attendance_status, missed_breaks_count, safety_meetings_attended, safety_meetings_missed, inspections_completed, inspections_missed')
    .eq('employee_id', emp.id)
    .gte('snapshot_date', cutoff)
    .order('snapshot_date', { ascending: false })

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">My Performance</h1>
        <p className="text-muted-foreground text-sm mt-1">Your last 90 days</p>
      </div>
      <PerformanceClient employees={[{ id: emp.id, name: emp.name, role: emp.role, snapshots: snapshots ?? [] }]} />
    </div>
  )
}
