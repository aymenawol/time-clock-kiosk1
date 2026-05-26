import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import InspectionClient from './inspection-client'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function InspectionPage({ params }: { params: { type: string } }) {
  const type = params.type
  if (type !== 'pre_trip' && type !== 'post_trip') notFound()

  const { user } = await getServerUser()
  const supabase = await createSupabaseServerClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: employee } = await supabase
    .from('employees')
    .select('id, first_name, last_name')
    .eq('auth_user_id', user?.id)
    .single()

  const { data: shift } = employee
    ? await supabase
        .from('shifts')
        .select('id, date, status, bus:bus_id(id, bus_number)')
        .eq('employee_id', employee.id)
        .eq('date', today)
        .in('status', ['active', 'scheduled'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  let inspection = null
  let items: any[] = []

  if (shift) {
    const { data: existingInspection } = await supabase
      .from('vehicle_inspections')
      .select('*')
      .eq('shift_id', shift.id)
      .eq('inspection_type', type)
      .maybeSingle()

    if (existingInspection) {
      inspection = existingInspection
      const { data: itemData } = await supabase
        .from('inspection_items')
        .select('*')
        .eq('inspection_id', existingInspection.id)
      items = itemData ?? []
    }
  }

  return (
    <div className="p-4">
      <InspectionClient
        type={type as 'pre_trip' | 'post_trip'}
        employee={employee}
        shift={shift as any}
        existingInspection={inspection}
        existingItems={items}
        today={today}
      />
    </div>
  )
}
