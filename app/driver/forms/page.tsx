import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import DriverFormsClient from './forms-client'

export default async function DriverFormsPage() {
  const { user } = await getServerUser()
  if (!user) redirect('/')

  const supabase = await createSupabaseServerClient()

  const { data: emp } = await supabase
    .from('employees')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!emp) {
    return <div className="p-6 text-muted-foreground">Employee record not found.</div>
  }

  const [{ data: submissions }, { data: acks }] = await Promise.all([
    supabase
      .from('form_submissions')
      .select('*')
      .eq('employee_id', emp.id)
      .order('submitted_at', { ascending: false }),
    supabase
      .from('form_acknowledgements')
      .select('submission_id')
      .eq('employee_id', emp.id),
  ])

  const ackedIds = new Set((acks ?? []).map((a: any) => a.submission_id))

  const withAck = (submissions ?? []).map((s: any) => ({ ...s, acked: ackedIds.has(s.id) }))

  return <DriverFormsClient submissions={withAck as any} />
}
