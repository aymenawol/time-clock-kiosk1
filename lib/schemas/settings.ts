import { z } from 'zod'

// Bounds for the admin-editable rule sets persisted into app_settings.
// Prevents a bad config (e.g. negative/huge values) from corrupting the break
// scheduler or payroll engine that read these.

export const BreakRulesSchema = z.object({
  break_count:                z.number().int().min(0).max(4),
  duration_minutes:           z.number().int().min(1).max(120),
  flex_minutes:               z.number().int().min(0).max(120),
  break1_after_start_minutes: z.number().int().min(0).max(1440),
  break2_before_end_minutes:  z.number().int().min(0).max(1440),
  default_shift_minutes:      z.number().int().min(60).max(1440),
  overstay_reminder_minutes:  z.number().int().min(0).max(240),
  overstay_alert_minutes:     z.number().int().min(0).max(240),
  allow_dispatcher_override:  z.boolean(),
})

export const OvertimeRulesSchema = z.object({
  daily_ot_threshold_hours:  z.number().min(0).max(24),
  weekly_ot_threshold_hours: z.number().min(0).max(168),
  ot_multiplier:             z.number().min(1).max(5),
  award_method:              z.string().min(1).max(40),
  bid_cycle_months:          z.number().int().min(1).max(12),
})
