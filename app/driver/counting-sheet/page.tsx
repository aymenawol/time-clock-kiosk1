import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import CountingSheetClient from './counting-sheet-client'

export const dynamic = 'force-dynamic'

export default async function CountingSheetPage() {
  const { user } = await getServerUser()
  const supabase = await createSupabaseServerClient()

  const today = new Date().toISOString().slice(0, 10)

  const { data: employee } = await supabase
    .from('employees')
    .select('id, name')
    .eq('auth_user_id', user?.id)
    .single()

  const { data: shift } = employee
    ? await supabase
        .from('shifts')
        .select('id, date, status, bus:bus_id(id, bus_number), breaks(*)')
        .eq('employee_id', employee.id)
        .eq('date', today)
        .in('status', ['active', 'scheduled'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  // Load or create counting sheet
  let sheet = null
  let rows: any[] = []

  if (shift) {
    const { data: existing } = await supabase
      .from('counting_sheets')
      .select('*')
      .eq('shift_id', shift.id)
      .maybeSingle()

    if (existing) {
      sheet = existing
      const { data: rowData } = await supabase
        .from('counting_rows')
        .select('*')
        .eq('sheet_id', existing.id)
        .order('row_order', { ascending: true })
      rows = rowData ?? []
    }
  }

  return (
    <div className="p-4">
      <CountingSheetClient
        employee={employee}
        shift={shift as any}
        existingSheet={sheet}
        existingRows={rows}
        today={today}
      />
    </div>
  )
}
