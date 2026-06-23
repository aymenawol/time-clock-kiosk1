import Link from 'next/link'
import { FORM_TYPE_LABELS } from '@/lib/supabase'
import { FormType } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase-server'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, ChevronRight } from 'lucide-react'

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
    <div className="space-y-6">
      <Link href="/driver/forms" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 w-fit">
        <ArrowLeft className="size-4" /> My Forms
      </Link>
      <h1 className="text-2xl font-bold text-foreground">New Form</h1>
      <div className="space-y-3">
        {types.map(type => (
          <Link key={type} href={`/driver/forms/new/${type}`} className="block">
            <Card className="transition-colors hover:border-ring hover:bg-accent">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-foreground font-medium">{FORM_TYPE_LABELS[type]}</p>
                  <p className="text-muted-foreground text-sm mt-0.5">{FORM_DESCRIPTIONS[type]}</p>
                </div>
                <ChevronRight className="size-5 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
