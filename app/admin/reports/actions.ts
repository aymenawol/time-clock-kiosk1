'use server'

import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import { type ActionResult, ok, fail } from '@/lib/actions/result'
import { fetchReport, isReportTab, REPORT_CONFIG, type ReportTab } from './report-data'

async function requireReportsRole() {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthenticated')
  const role = user.app_metadata?.role as string | undefined
  if (role !== 'admin' && role !== 'management' && role !== 'payroll') {
    throw new Error('Forbidden')
  }
  return await createSupabaseServerClient()
}

function toCsv(cols: string[], rows: Record<string, any>[]): string {
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [
    cols.map(esc).join(','),
    ...rows.map((r) => cols.map((c) => esc(r[c])).join(',')),
  ].join('\n')
}

/**
 * Exports a full report (all rows, not just the current page) as a CSV string.
 * This is the one intentional unbounded read — an explicit user action — and it
 * still projects only the report's columns.
 */
export async function exportReportCSVAction(
  tab: string
): Promise<ActionResult<{ filename: string; csv: string }>> {
  let supabase
  try {
    supabase = await requireReportsRole()
  } catch (e: any) {
    return fail(e.message)
  }

  if (!isReportTab(tab)) return fail('Unknown report')

  const config = REPORT_CONFIG[tab as ReportTab]
  try {
    const { rows } = await fetchReport(supabase, tab as ReportTab)
    return ok({ filename: config.file, csv: toCsv(config.cols, rows) })
  } catch (e: any) {
    return fail(e.message ?? 'Failed to build report')
  }
}
