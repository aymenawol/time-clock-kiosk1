import type { createSupabaseServerClient } from '@/lib/supabase-server'

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

export const REPORT_TABS = ['hours', 'overtime', 'forms', 'safety', 'bids'] as const
export type ReportTab = (typeof REPORT_TABS)[number]

export const REPORTS_PAGE_SIZE = 50

export const REPORT_CONFIG: Record<ReportTab, { label: string; cols: string[]; file: string }> = {
  hours:    { label: 'Employee Hours',   cols: ['name', 'date', 'clock_in', 'clock_out', 'total_hours'],                         file: 'employee-hours.csv' },
  overtime: { label: 'Overtime Awards',  cols: ['employee_name', 'date', 'duration_hours', 'award_method'],                      file: 'overtime-awards.csv' },
  forms:    { label: 'Form Submissions', cols: ['employee_name', 'form_type', 'status', 'submitted_at'],                         file: 'form-submissions.csv' },
  safety:   { label: 'Safety Meetings',  cols: ['title', 'department', 'scheduled_date', 'signin_count'],                        file: 'safety-meetings.csv' },
  bids:     { label: 'Bid Awards',       cols: ['cycle_name', 'employee_name', 'slot_bid_number', 'preference_rank', 'award_method'], file: 'bid-awards.csv' },
}

export function isReportTab(value: unknown): value is ReportTab {
  return typeof value === 'string' && (REPORT_TABS as readonly string[]).includes(value)
}

export interface ReportPage {
  rows: Record<string, any>[]
  count: number
}

/**
 * Fetches a single report. When `range` is supplied the query is bounded with
 * `.range()` + an exact count (server-side pagination); when omitted every row
 * is returned (the explicit CSV-export path). All queries project only the
 * columns rendered/exported — never `select('*')`.
 */
export async function fetchReport(
  supabase: ServerClient,
  tab: ReportTab,
  range?: { from: number; to: number }
): Promise<ReportPage> {
  const applyRange = <T extends { range: (a: number, b: number) => T }>(q: T): T =>
    range ? q.range(range.from, range.to) : q

  switch (tab) {
    case 'hours': {
      // v2: hours come from `shifts` (legacy `time_entries` dropped in phase11).
      const { data, count } = await applyRange(
        supabase
          .from('shifts')
          .select('employees(name), date, actual_start, actual_end, total_hours', { count: 'exact' })
          .order('date', { ascending: false }) as any
      )
      const rows = (data ?? []).map((r: any) => ({
        name:        r.employees?.name ?? '—',
        date:        r.date,
        clock_in:    r.actual_start ? new Date(r.actual_start).toLocaleTimeString() : '—',
        clock_out:   r.actual_end ? new Date(r.actual_end).toLocaleTimeString() : '—',
        total_hours: r.total_hours ?? '—',
      }))
      return { rows, count: count ?? 0 }
    }

    case 'overtime': {
      const { data, count } = await applyRange(
        supabase
          .from('overtime_awards')
          .select('employees(name), overtime_shifts(date, duration_hours), award_method', { count: 'exact' })
          .order('awarded_at', { ascending: false }) as any
      )
      const rows = (data ?? []).map((r: any) => ({
        employee_name:  r.employees?.name ?? '—',
        date:           r.overtime_shifts?.date ?? '—',
        duration_hours: r.overtime_shifts?.duration_hours ?? '—',
        award_method:   r.award_method,
      }))
      return { rows, count: count ?? 0 }
    }

    case 'forms': {
      const { data, count } = await applyRange(
        supabase
          .from('form_submissions')
          .select('employees(name), form_type, status, submitted_at', { count: 'exact' })
          .order('submitted_at', { ascending: false }) as any
      )
      const rows = (data ?? []).map((r: any) => ({
        employee_name: r.employees?.name ?? '—',
        form_type:     r.form_type,
        status:        r.status,
        submitted_at:  r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : '—',
      }))
      return { rows, count: count ?? 0 }
    }

    case 'safety': {
      const { data, count } = await applyRange(
        supabase
          .from('safety_meetings')
          .select('id, title, department, scheduled_date', { count: 'exact' })
          .order('scheduled_date', { ascending: false }) as any
      )
      const meetings = (data ?? []) as any[]
      // Count sign-ins only for the meetings on this page (bounded `.in()`),
      // instead of pulling every safety_meeting_signins row to count in JS.
      const ids = meetings.map((m) => m.id)
      const signinMap: Record<string, number> = {}
      if (ids.length) {
        const { data: signins } = await supabase
          .from('safety_meeting_signins')
          .select('meeting_id')
          .in('meeting_id', ids)
        ;(signins ?? []).forEach((s: any) => {
          signinMap[s.meeting_id] = (signinMap[s.meeting_id] ?? 0) + 1
        })
      }
      const rows = meetings.map((m) => ({
        title:          m.title,
        department:     m.department,
        scheduled_date: m.scheduled_date,
        signin_count:   signinMap[m.id] ?? 0,
      }))
      return { rows, count: count ?? 0 }
    }

    case 'bids': {
      const { data, count } = await applyRange(
        supabase
          .from('shift_bid_awards')
          .select(
            'employees(name), shift_bid_slots(bid_number), shift_bid_cycles(name), preference_rank, award_method',
            { count: 'exact' }
          )
          .order('awarded_at', { ascending: false }) as any
      )
      const rows = (data ?? []).map((r: any) => ({
        cycle_name:      r.shift_bid_cycles?.name ?? '—',
        employee_name:   r.employees?.name ?? '—',
        slot_bid_number: r.shift_bid_slots?.bid_number ?? '—',
        preference_rank: r.preference_rank ?? '—',
        award_method:    r.award_method,
      }))
      return { rows, count: count ?? 0 }
    }
  }
}
