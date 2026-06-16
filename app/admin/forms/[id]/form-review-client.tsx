'use client'
import { useTransition, useState } from 'react'
import { FormSubmission, FORM_TYPE_LABELS, FORM_STATUS_COLOR } from '@/lib/supabase'
import { reviewFormAction, approveResignationAction } from './actions'

interface Props {
  submission: FormSubmission & { employees: { name: string } | null }
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
    <div className="p-6 max-w-3xl mx-auto">
      <a href="/admin/forms" className="text-sm text-muted-foreground hover:text-foreground mb-4 block">← All Forms</a>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{FORM_TYPE_LABELS[submission.form_type]}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {submission.employees?.name ?? submission.employee_id} ·{' '}
            Submitted {new Date(submission.submitted_at).toLocaleString()}
            {submission.version > 1 && <> · Resubmission v{submission.version}</>}
          </p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${FORM_STATUS_COLOR[submission.status]}`}>
          {submission.status}
        </span>
      </div>

      {/* Payload display */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-3">Form Data</h2>
        <dl className="space-y-2">
          {Object.entries(payload).map(([key, val]) => (
            <div key={key} className="grid grid-cols-3 gap-2">
              <dt className="text-muted-foreground text-xs col-span-1 capitalize">{key.replace(/_/g, ' ')}</dt>
              <dd className="text-gray-200 text-xs col-span-2 break-words">
                {Array.isArray(val) ? val.join(', ') : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val ?? '—')}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Review actions */}
      {['submitted','under_review'].includes(submission.status) && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Review Decision</h2>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Comments (optional)</label>
            <textarea
              rows={3}
              value={comments}
              onChange={e => setComments(e.target.value)}
              className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-sm"
            />
          </div>

          {err && <p className="text-red-400 text-sm">{err}</p>}
          {success && <p className="text-green-400 text-sm">{success}</p>}

          <div className="flex gap-3">
            {submission.form_type === 'resignation' ? (
              <button
                disabled={pending}
                onClick={() => act(() => approveResignationAction(submission.id, comments))}
                className="px-4 py-2 bg-green-700 hover:bg-green-600 text-foreground text-sm rounded disabled:opacity-50"
              >
                Approve Resignation
              </button>
            ) : (
              <button
                disabled={pending}
                onClick={() => act(() => reviewFormAction(submission.id, 'approved', comments))}
                className="px-4 py-2 bg-green-700 hover:bg-green-600 text-foreground text-sm rounded disabled:opacity-50"
              >
                Approve
              </button>
            )}
            <button
              disabled={pending}
              onClick={() => act(() => reviewFormAction(submission.id, 'denied', comments))}
              className="px-4 py-2 bg-red-700 hover:bg-red-600 text-foreground text-sm rounded disabled:opacity-50"
            >
              Deny
            </button>
            <button
              disabled={pending}
              onClick={() => act(() => reviewFormAction(submission.id, 'returned', comments))}
              className="px-4 py-2 bg-yellow-700 hover:bg-yellow-600 text-foreground text-sm rounded disabled:opacity-50"
            >
              Return for Revision
            </button>
          </div>
        </div>
      )}

      {/* Show existing decision */}
      {!['submitted','under_review'].includes(submission.status) && submission.reviewer_comments && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-2">Reviewer Comments</h2>
          <p className="text-foreground text-sm whitespace-pre-wrap">{submission.reviewer_comments}</p>
          {submission.reviewed_at && (
            <p className="text-muted-foreground text-xs mt-2">Reviewed {new Date(submission.reviewed_at).toLocaleString()}</p>
          )}
        </div>
      )}
    </div>
  )
}
