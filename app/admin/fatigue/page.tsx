import { createSupabaseServerClient } from '@/lib/supabase-server'
import FatigueClient from './fatigue-client'

export default async function FatiguePage() {
  const supabase = await createSupabaseServerClient()

  const { data: alerts } = await supabase
    .from('fatigue_alerts')
    .select(`
      id, employee_id, alert_type,
      shift_hours, consecutive_count, weekly_ot_hours,
      triggered_at, resolved_at, notes, dismissed_at, dismiss_reason,
      employees!inner(name),
      resolver:auth_users_resolved(email),
      dismisser:auth_users_dismissed(email)
    `)
    .order('triggered_at', { ascending: false })
    .limit(200)

  // Fallback to simpler query without auth user joins if complex join fails
  const { data: alertsSimple } = !alerts ? await supabase
    .from('fatigue_alerts')
    .select('id, employee_id, alert_type, shift_hours, consecutive_count, weekly_ot_hours, triggered_at, resolved_at, notes, dismissed_at, dismiss_reason, employees(name)')
    .order('triggered_at', { ascending: false })
    .limit(200)
  : { data: null }

  const raw = alerts ?? alertsSimple ?? []

  const enriched = raw.map((a: Record<string, unknown>) => {
    const emp = a.employees as Record<string, unknown> | null
    return {
      id:               a.id as string,
      employee_id:      a.employee_id as string,
      employee_name:    emp ? (emp.name as string) : 'Unknown',
      alert_type:       a.alert_type as 'single_shift' | 'consecutive_days' | 'ot_threshold',
      shift_hours:      a.shift_hours as number | null,
      consecutive_count: a.consecutive_count as number | null,
      weekly_ot_hours:  a.weekly_ot_hours as number | null,
      triggered_at:     a.triggered_at as string,
      resolved_at:      a.resolved_at as string | null,
      resolved_by_name: null,
      notes:            a.notes as string | null,
      dismissed_at:     a.dismissed_at as string | null,
      dismiss_reason:   a.dismiss_reason as string | null,
    }
  })

  return <FatigueClient alerts={enriched} />
}
