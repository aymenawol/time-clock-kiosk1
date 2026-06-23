'use client'
import { useTransition, useState } from 'react'
import Link from 'next/link'
import { FormSubmission, FORM_TYPE_LABELS } from '@/lib/supabase'
import { acknowledgeFormAction } from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Check, Plus } from 'lucide-react'

interface Props {
  submissions: (FormSubmission & { acked: boolean })[]
}

// Form status → operational ramp (DESIGN §4)
const FORM_STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  approved: 'ok',
  submitted: 'info',
  under_review: 'info',
  returned: 'warn',
  denied: 'danger',
}

export default function DriverFormsClient({ submissions }: Props) {
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  function handleAck(id: string) {
    setErr(null)
    startTransition(async () => {
      try { await acknowledgeFormAction(id) }
      catch (e: any) { setErr(e.message) }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground">My Forms</h1>
        <Button asChild size="sm">
          <Link href="/driver/forms/new">
            <Plus className="size-4" /> New Form
          </Link>
        </Button>
      </div>

      {err && <p className="text-danger text-sm">{err}</p>}

      {submissions.length === 0 ? (
        <p className="text-muted-foreground text-sm">No forms submitted yet.</p>
      ) : (
        <div className="space-y-3">
          {submissions.map(sub => (
            <Card key={sub.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                  <span className="text-foreground font-medium text-sm">{FORM_TYPE_LABELS[sub.form_type]}</span>
                  <Badge variant={FORM_STATUS_VARIANT[sub.status] ?? 'neutral'}>
                    {sub.status}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-xs">
                  Submitted {new Date(sub.submitted_at).toLocaleString()}
                  {sub.version > 1 && <> · v{sub.version}</>}
                </p>
                {sub.reviewer_comments && (
                  <div className="mt-2 bg-muted rounded-lg p-2">
                    <p className="text-muted-foreground text-xs">Reviewer: {sub.reviewer_comments}</p>
                  </div>
                )}
                {['approved','denied'].includes(sub.status) && !sub.acked && (
                  <Button onClick={() => handleAck(sub.id)} disabled={pending} variant="secondary" size="sm" className="mt-2">
                    Confirm Receipt
                  </Button>
                )}
                {sub.acked && (
                  <p className="text-muted-foreground text-xs mt-2 flex items-center gap-1">
                    <Check className="size-3.5 text-ok" /> Receipt confirmed
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
