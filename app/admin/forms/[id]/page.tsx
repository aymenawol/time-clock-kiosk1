import { redirect, notFound } from 'next/navigation'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import FormReviewClient from './form-review-client'

interface Props { params: Promise<{ id: string }> }

export default async function FormReviewPage({ params }: Props) {
  const { id } = await params
  const { user } = await getServerUser()
  if (!user) redirect('/login')

  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('form_submissions')
    .select('*, employees(name)')
    .eq('id', id)
    .single()

  if (!data) notFound()

  return <FormReviewClient submission={data as any} />
}
