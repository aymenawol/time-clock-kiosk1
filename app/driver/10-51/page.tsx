import { redirect } from 'next/navigation'
import { Accessibility } from 'lucide-react'
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
      .eq('status', 'active')
      .order('actual_start', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (shift) {
      const busData = shift.buses as unknown as { id: string; bus_number: string } | null
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
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-warn-surface border border-warn-border text-warn flex items-center justify-center shrink-0">
          <Accessibility className="size-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">10-51 Wheelchair Request</h1>
          <p className="text-muted-foreground text-sm">Submit to dispatch for wheelchair assist</p>
        </div>
      </div>

      {!activeShift ? (
        <div className="bg-warn-surface border border-warn-border rounded-xl p-6 text-warn">
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
