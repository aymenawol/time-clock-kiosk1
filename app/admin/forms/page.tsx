import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import AdminFormsClient from './forms-client'

export default async function AdminFormsPage() {
  const { user } = await getServerUser()
  if (!user) redirect('/login')

  const supabase = await createSupabaseServerClient()
  const { data: submissions } = await supabase
    .from('form_submissions')
    .select('*, employees(name)')
    .order('submitted_at', { ascending: false })

  return <AdminFormsClient submissions={(submissions ?? []) as any} />
}
