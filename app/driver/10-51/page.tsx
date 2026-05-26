import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import WheelchairForm from './wheelchair-form'

export const metadata = { title: '10-51 Wheelchair Request' }

export default async function WheelchairPage() {
  const { user } = await getServerUser()
  if (!user) redirect('/')

  const role = (user.app_metadata?.role as string) ?? ''
  if (!['driver', 'admin', 'management'].includes(role)) redirect('/unauthorized')

  const supabase = await createSupabaseServerClient()

  // Employee id
  const { data: emp } = await supabase
    .from('employees')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  // Active shift + bus
  let activeShift: { id: string; bus: { id: string; bus_number: string } | null } | null = null
  if (emp?.id) {
    const { data: shift } = await supabase
      .from('shifts')
      .select('id, buses(id, bus_number)')
      .eq('employee_id', emp.id)
      .eq('status', 'clocked_in')
      .order('clock_in', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (shift) {
      const busData = shift.buses as { id: string; bus_number: string } | null
      activeShift = { id: shift.id, bus: busData }
    }
  }

  // Active airlines
  const { data: airlines } = await supabase
    .from('airlines')
    .select('id, name, terminal, wheelchair_contact')
    .eq('is_active', true)
    .order('name')

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-orange-900/60 flex items-center justify-center text-xl">
            ♿
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">10-51 Wheelchair Request</h1>
            <p className="text-gray-400 text-sm">Submit to dispatch for wheelchair assist</p>
          </div>
        </div>
      </div>

      {!activeShift ? (
        <div className="bg-yellow-950/50 border border-yellow-700 rounded-xl p-6 text-yellow-200">
          No active shift found. You must be clocked in to submit a wheelchair request.
        </div>
      ) : (
        <WheelchairForm
          employeeId={emp!.id}
          activeShift={activeShift}
          airlines={airlines ?? []}
        />
      )}
    </div>
  )
}
