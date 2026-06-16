'use client'
import { useState } from 'react'
import { FormSubmission, FORM_TYPE_LABELS, FORM_STATUS_COLOR, FormType, FormStatus } from '@/lib/supabase'
import Link from 'next/link'

interface Props {
  submissions: (FormSubmission & { employees: { name: string } | null })[]
}

const ALL = 'all'

export default function AdminFormsClient({ submissions }: Props) {
  const [typeFilter, setTypeFilter] = useState<FormType | 'all'>(ALL)
  const [statusFilter, setStatusFilter] = useState<FormStatus | 'all'>(ALL)

  const filtered = submissions.filter(s => {
    const typeOk = typeFilter === ALL || s.form_type === typeFilter
    const statusOk = statusFilter === ALL || s.status === statusFilter
    return typeOk && statusOk
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">Form Submissions</h1>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}
          className="bg-card border border-border rounded px-3 py-1.5 text-foreground text-sm">
          <option value={ALL}>All Types</option>
          {(Object.entries(FORM_TYPE_LABELS) as [FormType, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
          className="bg-card border border-border rounded px-3 py-1.5 text-foreground text-sm">
          <option value={ALL}>All Statuses</option>
          {(['submitted','under_review','approved','denied','returned'] as FormStatus[]).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="ml-auto text-muted-foreground text-sm self-center">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No submissions found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(sub => (
            <Link key={sub.id} href={`/admin/forms/${sub.id}`}
              className="block bg-card border border-border rounded-lg p-4 hover:border-border transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-foreground text-sm font-medium">{sub.employees?.name ?? sub.employee_id}</span>
                    <span className="text-muted-foreground text-xs">{FORM_TYPE_LABELS[sub.form_type]}</span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Submitted {new Date(sub.submitted_at).toLocaleDateString()}
                    {sub.reviewed_at && <> · Reviewed {new Date(sub.reviewed_at).toLocaleDateString()}</>}
                    {sub.version > 1 && <> · v{sub.version}</>}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${FORM_STATUS_COLOR[sub.status]}`}>
                  {sub.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
