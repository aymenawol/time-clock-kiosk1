import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerUser, createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

/**
 * N14 — employee self-service balances. Any authenticated employee can view
 * their own PTO / vacation / FMLA balances and their global seniority rank
 * (ordered seniority_number → hire_date across all active employees).
 */
export default async function BalancesPage() {
  const { user } = await getServerUser()
  if (!user) redirect('/login?redirectTo=/balances')

  const supabase = await createSupabaseServerClient()
  const { data: emp } = await supabase
    .from('employees')
    .select('id, name, employee_id, department, hire_date, seniority_number, pto_balance, vacation_balance, fmla_balance')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!emp) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground p-6">
        No employee profile is linked to your account. Contact your administrator.
      </div>
    )
  }

  // Global seniority rank: how many active employees rank ahead (lower number).
  let rank: number | null = null
  let totalRanked: number | null = null
  if (emp.seniority_number != null) {
    const [{ count: ahead }, { count: total }] = await Promise.all([
      supabase.from('employees').select('id', { count: 'exact', head: true })
        .eq('status', 'active').not('seniority_number', 'is', null)
        .lt('seniority_number', emp.seniority_number),
      supabase.from('employees').select('id', { count: 'exact', head: true })
        .eq('status', 'active').not('seniority_number', 'is', null),
    ])
    rank = (ahead ?? 0) + 1
    totalRanked = total ?? null
  }

  const balances = [
    { label: 'PTO', value: emp.pto_balance, color: 'text-blue-300' },
    { label: 'Vacation', value: emp.vacation_balance, color: 'text-green-300' },
    { label: 'FMLA', value: emp.fmla_balance, color: 'text-purple-300' },
  ]

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Balances</h1>
            <p className="text-muted-foreground text-sm">{emp.name} · ID {emp.employee_id}</p>
          </div>
          <Link href="/driver" className="text-sm text-muted-foreground hover:text-foreground">← Back</Link>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {balances.map((b) => (
            <div key={b.label} className="bg-card border border-border rounded-xl p-4 text-center">
              <p className={`text-3xl font-bold font-mono tabular-nums ${b.color}`}>{Number(b.value ?? 0).toFixed(1)}</p>
              <p className="text-muted-foreground text-xs mt-1 uppercase tracking-wide">{b.label} hours</p>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Department</span>
            <span className="text-foreground">{emp.department ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Hire date</span>
            <span className="text-foreground">{emp.hire_date ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Seniority number</span>
            <span className="text-foreground font-mono">{emp.seniority_number ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Seniority rank</span>
            <span className="text-foreground">
              {rank != null ? `#${rank}${totalRanked ? ` of ${totalRanked}` : ''}` : 'Not ranked'}
            </span>
          </div>
        </div>

        <p className="text-gray-600 text-xs">
          Balances are maintained by payroll. To request leave, use the Forms section.
        </p>
      </div>
    </div>
  )
}
