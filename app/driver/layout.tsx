import { redirect } from 'next/navigation'
import { getServerUser, createSupabaseServerClient } from '@/lib/supabase-server'
import DriverShell from '@/components/driver-shell'
import { FieldShell } from '@/components/app-shell/field-shell'

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getServerUser()
  if (!user) redirect('/')

  const role = (user.app_metadata?.role as string) ?? ''
  if (!['admin', 'management', 'driver'].includes(role)) redirect('/unauthorized')

  // Look up employee id + name + check for motion lock exemption
  const supabase = await createSupabaseServerClient()
  const { data: emp } = await supabase
    .from('employees')
    .select('id, name')
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
    <DriverShell employeeId={employeeId} isMotionLockExempt={isMotionLockExempt}>
      <FieldShell variant="driver" name={emp?.name ?? null}>
        {children}
      </FieldShell>
    </DriverShell>
  )
}
