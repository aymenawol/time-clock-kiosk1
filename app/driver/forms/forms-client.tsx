'use client'
import { useTransition, useState } from 'react'
import Link from 'next/link'
import { FormSubmission, FORM_TYPE_LABELS, FORM_STATUS_COLOR } from '@/lib/supabase'
import { acknowledgeFormAction } from './actions'

interface Props {
  submissions: (FormSubmission & { acked: boolean })[]
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
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">My Forms</h1>
        <Link href="/driver/forms/new"
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-foreground text-sm rounded">
          + New Form
        </Link>
      </div>

      {err && <p className="text-red-400 text-sm mb-4">{err}</p>}

      {submissions.length === 0 ? (
        <p className="text-muted-foreground text-sm">No forms submitted yet.</p>
      ) : (
        <div className="space-y-3">
          {submissions.map(sub => (
            <div key={sub.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-foreground font-medium text-sm">{FORM_TYPE_LABELS[sub.form_type]}</span>
                <span className={`px-2.5 py-1 rounded-full text-xs border ${FORM_STATUS_COLOR[sub.status]}`}>
                  {sub.status}
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                Submitted {new Date(sub.submitted_at).toLocaleString()}
                {sub.version > 1 && <> · v{sub.version}</>}
              </p>
              {sub.reviewer_comments && (
                <div className="mt-2 bg-muted rounded p-2">
                  <p className="text-muted-foreground text-xs">Reviewer: {sub.reviewer_comments}</p>
                </div>
              )}
              {['approved','denied'].includes(sub.status) && !sub.acked && (
                <button onClick={() => handleAck(sub.id)} disabled={pending}
                  className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-foreground text-xs rounded disabled:opacity-50">
                  Confirm Receipt
                </button>
              )}
              {sub.acked && (
                <p className="text-gray-600 text-xs mt-2">✓ Receipt confirmed</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
