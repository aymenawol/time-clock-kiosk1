'use client'
import { useTransition, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FormSubmission, FORM_TYPE_LABELS, FormStatus } from '@/lib/supabase'
import { reviewFormAction, approveResignationAction } from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  submission: FormSubmission & { employees: { name: string } | null }
}

const STATUS_VARIANT: Record<FormStatus, BadgeProps['variant']> = {
  submitted:    'info',
  under_review: 'info',
  approved:     'ok',
  denied:       'danger',
  returned:     'warn',
}

export default function FormReviewClient({ submission }: Props) {
  const [pending, startTransition] = useTransition()
  const [comments, setComments] = useState(submission.reviewer_comments ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function act(fn: () => Promise<void>) {
    setErr(null); setSuccess(null)
    startTransition(async () => {
      try { await fn(); setSuccess('Done.') }
      catch (e: any) { setErr(e.message) }
    })
  }

  const payload = submission.payload as Record<string, any>

  return (
    <div className="space-y-6">
      <Link href="/admin/forms" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All Forms
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground">{FORM_TYPE_LABELS[submission.form_type]}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {submission.employees?.name ?? submission.employee_id} ·{' '}
            Submitted {new Date(submission.submitted_at).toLocaleString()}
            {submission.version > 1 && <> · Resubmission v{submission.version}</>}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[submission.status]} className="self-start shrink-0">{submission.status}</Badge>
      </div>

      {/* Payload display */}
      <Card>
        <CardHeader>
          <CardTitle>Form Data</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2">
            {Object.entries(payload).map(([key, val]) => (
              <div key={key} className="grid grid-cols-3 gap-2">
                <dt className="text-muted-foreground text-xs col-span-1 capitalize">{key.replace(/_/g, ' ')}</dt>
                <dd className="text-foreground text-xs col-span-2 break-words">
                  {Array.isArray(val) ? val.join(', ') : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val ?? '—')}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Review actions */}
      {['submitted','under_review'].includes(submission.status) && (
        <Card>
          <CardHeader>
            <CardTitle>Review Decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="review-comments">Comments (optional)</Label>
              <Textarea
                id="review-comments"
                rows={3}
                value={comments}
                onChange={e => setComments(e.target.value)}
              />
            </div>

            {err && <p className="text-danger text-sm">{err}</p>}
            {success && <p className="text-ok text-sm">{success}</p>}

            <div className="flex flex-wrap gap-3">
              {submission.form_type === 'resignation' ? (
                <Button variant="success" disabled={pending}
                  onClick={() => act(() => approveResignationAction(submission.id, comments))}>
                  Approve Resignation
                </Button>
              ) : (
                <Button variant="success" disabled={pending}
                  onClick={() => act(() => reviewFormAction(submission.id, 'approved', comments))}>
                  Approve
                </Button>
              )}
              <Button variant="destructive" disabled={pending}
                onClick={() => act(() => reviewFormAction(submission.id, 'denied', comments))}>
                Deny
              </Button>
              <Button variant="secondary" disabled={pending}
                onClick={() => act(() => reviewFormAction(submission.id, 'returned', comments))}>
                Return for Revision
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Show existing decision */}
      {!['submitted','under_review'].includes(submission.status) && submission.reviewer_comments && (
        <Card>
          <CardHeader>
            <CardTitle>Reviewer Comments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground text-sm whitespace-pre-wrap">{submission.reviewer_comments}</p>
            {submission.reviewed_at && (
              <p className="text-muted-foreground text-xs mt-2">Reviewed {new Date(submission.reviewed_at).toLocaleString()}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
