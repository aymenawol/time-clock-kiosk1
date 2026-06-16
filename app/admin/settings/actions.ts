'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requireRole } from '@/lib/auth/rbac'
import { BreakRulesSchema, OvertimeRulesSchema } from '@/lib/schemas/settings'

/**
 * N13 — admin rules-config surface. Persists the break and overtime rule sets
 * into app_settings (the singleton config row that the break subsystem and
 * payroll engine read). Admin/management only.
 */

export interface BreakRules {
  break_count: number
  duration_minutes: number
  flex_minutes: number
  break1_after_start_minutes: number
  break2_before_end_minutes: number
  default_shift_minutes: number
  overstay_reminder_minutes: number
  overstay_alert_minutes: number
  allow_dispatcher_override: boolean
}

export interface OvertimeRules {
  daily_ot_threshold_hours: number
  weekly_ot_threshold_hours: number
  ot_multiplier: number
  award_method: string
  bid_cycle_months: number
}

const num = (v: FormDataEntryValue | null, fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export async function updateBreakRulesAction(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const auth = await requireRole('admin', 'management')
  if (!auth.ok) return { error: auth.error }

  const rules: BreakRules = {
    break_count:                num(formData.get('break_count'), 2),
    duration_minutes:           num(formData.get('duration_minutes'), 15),
    flex_minutes:               num(formData.get('flex_minutes'), 45),
    break1_after_start_minutes: num(formData.get('break1_after_start_minutes'), 135),
    break2_before_end_minutes:  num(formData.get('break2_before_end_minutes'), 120),
    default_shift_minutes:      num(formData.get('default_shift_minutes'), 480),
    overstay_reminder_minutes:  num(formData.get('overstay_reminder_minutes'), 17),
    overstay_alert_minutes:     num(formData.get('overstay_alert_minutes'), 20),
    allow_dispatcher_override:  formData.get('allow_dispatcher_override') === 'on',
  }

  const parsed = BreakRulesSchema.safeParse(rules)
  if (!parsed.success) return { error: 'Invalid break rule values — check the ranges.' }

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('app_settings')
    .update({ break_rules: parsed.data })
    .eq('id', 'singleton')
  if (error) return { error: error.message }

  revalidatePath('/admin/settings')
  return { success: true }
}

export async function updateOvertimeRulesAction(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const auth = await requireRole('admin', 'management')
  if (!auth.ok) return { error: auth.error }

  const rules: OvertimeRules = {
    daily_ot_threshold_hours:  num(formData.get('daily_ot_threshold_hours'), 8),
    weekly_ot_threshold_hours: num(formData.get('weekly_ot_threshold_hours'), 40),
    ot_multiplier:             num(formData.get('ot_multiplier'), 1.5),
    award_method:              (formData.get('award_method') as string) || 'seniority',
    bid_cycle_months:          num(formData.get('bid_cycle_months'), 4),
  }

  const parsed = OvertimeRulesSchema.safeParse(rules)
  if (!parsed.success) return { error: 'Invalid overtime rule values — check the ranges.' }

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('app_settings')
    .update({ overtime_rules: parsed.data })
    .eq('id', 'singleton')
  if (error) return { error: error.message }

  revalidatePath('/admin/settings')
  return { success: true }
}
