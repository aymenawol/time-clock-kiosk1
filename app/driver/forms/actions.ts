'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import { FormType } from '@/lib/supabase'

const VALID_FORM_TYPES: FormType[] = ['time_off', 'bid_vacation_change', 'incident_report', 'fmla_conversion', 'resignation']

export async function submitFormAction(formType: FormType, payload: Record<string, any>) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')

  // Validate untrusted input before it lands in form_submissions.
  if (!VALID_FORM_TYPES.includes(formType)) throw new Error('Invalid form type')
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid form data')
  if (JSON.stringify(payload).length > 20_000) throw new Error('Form data is too large')

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
