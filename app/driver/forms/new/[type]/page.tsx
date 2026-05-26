import { notFound, redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase-server'
import { FormType } from '@/lib/supabase'
import FormTypeClient from './form-type-client'

const VALID_TYPES: FormType[] = [
  'time_off',
  'bid_vacation_change',
  'incident_report',
  'fmla_conversion',
  'resignation',
]

interface Props { params: Promise<{ type: string }> }

export default async function DriverFormNewTypePage({ params }: Props) {
  const { type } = await params
  const { user } = await getServerUser()
  if (!user) redirect('/')

  if (!VALID_TYPES.includes(type as FormType)) notFound()

  return <FormTypeClient formType={type as FormType} />
}
