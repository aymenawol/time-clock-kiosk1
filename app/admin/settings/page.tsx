import { createSupabaseServerClient } from '@/lib/supabase-server'
import SettingsClient from './settings-client'
import type { BreakRules, OvertimeRules } from './actions'

export const dynamic = 'force-dynamic'

const DEFAULT_BREAK: BreakRules = {
  break_count: 2, duration_minutes: 15, flex_minutes: 45,
  break1_after_start_minutes: 135, break2_before_end_minutes: 120,
  default_shift_minutes: 480, overstay_reminder_minutes: 17,
  overstay_alert_minutes: 20, allow_dispatcher_override: true,
}
const DEFAULT_OT: OvertimeRules = {
  daily_ot_threshold_hours: 8, weekly_ot_threshold_hours: 40,
  ot_multiplier: 1.5, award_method: 'seniority', bid_cycle_months: 4,
}

export default async function AdminSettingsPage() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('app_settings')
    .select('break_rules, overtime_rules')
    .eq('id', 'singleton')
    .maybeSingle()

  const breakRules = { ...DEFAULT_BREAK, ...((data?.break_rules as Partial<BreakRules>) ?? {}) }
  const overtimeRules = { ...DEFAULT_OT, ...((data?.overtime_rules as Partial<OvertimeRules>) ?? {}) }

  return <SettingsClient breakRules={breakRules} overtimeRules={overtimeRules} />
}
