'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import { FormType } from '@/lib/supabase'

export async function submitFormAction(formType: FormType, payload: Record<string, any>) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createSupabaseServerClient()

  const { data: emp } = await supabase
    .from('employees')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()
  if (!emp) throw new Error('Employee not found')

  const { error } = await supabase.from('form_submissions').insert({
    employee_id: emp.id,
    form_type:   formType,
    payload,
    status:      'submitted',
  })
  if (error) throw new Error(error.message)

  revalidatePath('/driver/forms')
  redirect('/driver/forms')
}

export async function acknowledgeFormAction(submissionId: string) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createSupabaseServerClient()

  const { data: emp } = await supabase
    .from('employees')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()
  if (!emp) throw new Error('Employee not found')

  const { error } = await supabase.from('form_acknowledgements').insert({
    submission_id: submissionId,
    employee_id:   emp.id,
  })
  if (error && error.code !== '23505') throw new Error(error.message)
  revalidatePath('/driver/forms')
}
