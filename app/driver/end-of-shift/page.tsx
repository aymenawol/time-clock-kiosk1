import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import EndOfShiftClient from './end-of-shift-client'

export const dynamic = 'force-dynamic'

export default async function EndOfShiftPage() {
  const { user } = await getServerUser()
  if (!user) redirect('/')

  const supabase = await createSupabaseServerClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: employee } = await supabase
    .from('employees')
    .select('id, first_name, last_name')
    .eq('auth_user_id', user.id)
    .single()

  const { data: shift } = employee
    ? await supabase
        .from('shifts')
        .select('id, bus_id, bus:bus_id(id, bus_number, bus_type, fuel_level)')
        .eq('employee_id', employee.id)
        .eq('date', today)
        .in('status', ['active', 'scheduled'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  return (
    <div className="p-4 max-w-md mx-auto">
      <EndOfShiftClient shift={shift as any} />
    </div>
  )
}
