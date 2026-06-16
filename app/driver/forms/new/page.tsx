import Link from 'next/link'
import { FORM_TYPE_LABELS } from '@/lib/supabase'
import { FormType } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase-server'

const FORM_DESCRIPTIONS: Record<FormType, string> = {
  time_off:           'Request scheduled time off',
  bid_vacation_change:'Request a change to your bid or vacation assignment',
  incident_report:    'Report a workplace incident or near-miss',
  fmla_conversion:    'Convert leave to FMLA protected status',
  resignation:        'Submit a formal resignation',
}

export default async function DriverFormsNewPage() {
  const { user } = await getServerUser()
  if (!user) redirect('/')

  const types = Object.keys(FORM_TYPE_LABELS) as FormType[]

  return (
    <div className="p-6 max-w-xl mx-auto">
      <a href="/driver/forms" className="text-sm text-muted-foreground hover:text-foreground mb-4 block">← My Forms</a>
      <h1 className="text-2xl font-bold text-foreground mb-6">New Form</h1>
      <div className="space-y-3">
        {types.map(type => (
          <Link key={type} href={`/driver/forms/new/${type}`}
            className="block bg-card border border-border hover:border-gray-600 rounded-lg p-4 transition-colors">
            <p className="text-foreground font-medium">{FORM_TYPE_LABELS[type]}</p>
            <p className="text-muted-foreground text-sm mt-0.5">{FORM_DESCRIPTIONS[type]}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
