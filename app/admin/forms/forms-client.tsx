'use client'
import { useState } from 'react'
import { FormSubmission, FORM_TYPE_LABELS, FormType, FormStatus } from '@/lib/supabase'
import Link from 'next/link'
import { Badge, type BadgeProps } from '@/components/ui/badge'

interface Props {
  submissions: (FormSubmission & { employees: { name: string } | null })[]
}

const ALL = 'all'

const STATUS_VARIANT: Record<FormStatus, BadgeProps['variant']> = {
  submitted:    'info',
  under_review: 'info',
  approved:     'ok',
  denied:       'danger',
  returned:     'warn',
}

export default function AdminFormsClient({ submissions }: Props) {
  const [typeFilter, setTypeFilter] = useState<FormType | 'all'>(ALL)
  const [statusFilter, setStatusFilter] = useState<FormStatus | 'all'>(ALL)

  const filtered = submissions.filter(s => {
    const typeOk = typeFilter === ALL || s.form_type === typeFilter
    const statusOk = statusFilter === ALL || s.status === statusFilter
    return typeOk && statusOk
  })

  const selectClass =
    'h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Form Submissions</h1>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className={selectClass}>
          <option value={ALL}>All Types</option>
          {(Object.entries(FORM_TYPE_LABELS) as [FormType, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className={selectClass}>
          <option value={ALL}>All Statuses</option>
          {(['submitted','under_review','approved','denied','returned'] as FormStatus[]).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="text-muted-foreground text-sm sm:ml-auto sm:self-center">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No submissions found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(sub => (
            <Link key={sub.id} href={`/admin/forms/${sub.id}`}
              className="block rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <span className="text-foreground text-sm font-medium truncate">{sub.employees?.name ?? sub.employee_id}</span>
                    <span className="text-muted-foreground text-xs">{FORM_TYPE_LABELS[sub.form_type]}</span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Submitted {new Date(sub.submitted_at).toLocaleDateString()}
                    {sub.reviewed_at && <> · Reviewed {new Date(sub.reviewed_at).toLocaleDateString()}</>}
                    {sub.version > 1 && <> · v{sub.version}</>}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[sub.status]} className="shrink-0">{sub.status}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
