import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import LostFoundForm from './lost-found-form'
import { Search } from 'lucide-react'

export const metadata = { title: 'Lost & Found Report' }

export default async function DriverLostFoundPage() {
  const { user } = await getServerUser()
  if (!user) redirect('/')

  const role = (user.app_metadata?.role as string) ?? ''
  if (!['driver', 'admin', 'management'].includes(role)) redirect('/unauthorized')

  const supabase = await createSupabaseServerClient()
  const { data: emp } = await supabase
    .from('employees')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  let busId: string | null  = null
  let busNumber = 'N/A'

  if (emp?.id) {
    const { data: shift } = await supabase
      .from('shifts')
      .select('id, buses(id, bus_number)')
      .eq('employee_id', emp.id)
      .eq('status', 'active')
      .order('actual_start', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (shift?.buses) {
      const bus = shift.buses as unknown as { id: string; bus_number: string }
      busId     = bus.id
      busNumber = bus.bus_number
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-info-surface border border-info-border flex items-center justify-center shrink-0">
          <Search className="size-5 text-info" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Lost & Found</h1>
          <p className="text-muted-foreground text-sm">Report an item found on your bus</p>
        </div>
      </div>

      <LostFoundForm
        employeeId={emp?.id ?? ''}
        busId={busId}
        busNumber={busNumber}
      />
    </div>
  )
}
