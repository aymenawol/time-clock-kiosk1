import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import PerformanceClient from './performance-client'

export const metadata = { title: 'Driver Performance' }

export default async function PerformancePage() {
  const { user } = await getServerUser()
  if (!user) redirect('/')

  const role = (user.app_metadata?.role as string) ?? ''
  if (!['admin', 'management', 'dispatcher', 'supervisor'].includes(role)) redirect('/unauthorized')

  const supabase = await createSupabaseServerClient()

  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: employees } = await supabase
    .from('employees')
    .select(`
      id, full_name, role,
      driver_performance_snapshots(
        snapshot_date, attendance_status, missed_breaks_count,
        safety_meetings_attended, safety_meetings_missed,
        inspections_completed, inspections_missed
      )
    `)
    .in('role', ['driver', 'fueler_washer'])
    .order('full_name')
    .gte('driver_performance_snapshots.snapshot_date', cutoff)

  type RawEmp = {
    id: string
    full_name: string
    role: string
    driver_performance_snapshots: {
      snapshot_date: string
      attendance_status: string
      missed_breaks_count: number
      safety_meetings_attended: number
      safety_meetings_missed: number
      inspections_completed: number
      inspections_missed: number
    }[]
  }

  const formatted = (employees ?? []).map((e: RawEmp) => ({
    id:        e.id,
    full_name: e.full_name,
    role:      e.role,
    snapshots: (e.driver_performance_snapshots ?? []).sort((a, b) =>
      b.snapshot_date.localeCompare(a.snapshot_date)
    ),
  }))

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Driver Performance</h1>
        <p className="text-gray-400 text-sm mt-1">
          Performance metrics based on the last 90 days of shift snapshots
        </p>
      </div>
      <PerformanceClient employees={formatted} />
    </div>
  )
}
