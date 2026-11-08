import { z } from "zod";

/**
 * Organization settings (organizations.settings jsonb). Defaults are Nevada
 * compliant and match the SQL fallbacks in the migrations (private.setting_*).
 * Keep the key names in sync with the SQL.
 */
export const orgSettingsSchema = z.object({
  /** 0 = Sunday, 1 = Monday (v0 used ISO weeks). Weekly overtime is counted per fixed workweek. */
  workweekStartsOn: z.number().int().min(0).max(6).default(1),
  clock24h: z.boolean().default(false),
  labor: z
    .object({
      /** Nevada minimum wage, cents per hour ($12.00 since 2024-07-01). */
      minimumWageCents: z.number().int().min(0).default(1200),
      /** Apply NRS 608.018 daily overtime (> 8 h in a 24-hour workday). */
      dailyOvertime: z.boolean().default(true),
      dailyOvertimeMinutes: z.number().int().min(60).max(1440).default(480),
      weeklyOvertimeMinutes: z.number().int().min(60).max(10080).default(2400),
      overtimeMultiplier: z.number().min(1).max(3).default(1.5),
    })
    .prefault({}),
  breaks: z
    .object({
      /**
       * "fixed_two" is the v0 operation: two paid rest breaks, the first opening
       * `firstBreakAfterMinutes` after clock-in and the second opening
       * `secondBreakBeforeEndMinutes` before the planned end. "nevada_table"
       * spreads one rest per NAC 608.145 tier (adds a third on 11 h+ shifts).
       */
      restPolicy: z.enum(["fixed_two", "nevada_table"]).default("fixed_two"),
      firstBreakAfterMinutes: z.number().int().min(30).max(600).default(135),
      secondBreakBeforeEndMinutes: z.number().int().min(30).max(600).default(120),
      restMinutes: z.number().int().min(10).max(60).default(15),
      mealMinutes: z.number().int().min(30).max(120).default(30),
      /** Length of each planned break window ("flex" in v0). */
      windowMinutes: z.number().int().min(15).max(180).default(45),
      /** Planned shift length when no schedule is set. */
      defaultShiftMinutes: z.number().int().min(60).max(960).default(480),
      reminderGraceMinutes: z.number().int().min(0).max(30).default(2),
      overrunGraceMinutes: z.number().int().min(1).max(60).default(5),
      reopenWindowMinutes: z.number().int().min(5).max(180).default(45),
    })
    .prefault({}),
  fatigue: z
    .object({
      warnShiftHours: z.number().min(4).max(24).default(10),
      maxShiftHours: z.number().min(4).max(24).default(12),
      /** FMCSA passenger carriers: no driving after 15 h on duty. */
      maxOnDutyHours: z.number().min(4).max(24).default(15),
      /** FMCSA passenger carriers: 8 consecutive hours off duty. */
      minRestHours: z.number().min(4).max(24).default(8),
      /** v0 rule: alert when someone works more than this many days in one workweek. */
      maxDaysPerWeek: z.number().int().min(1).max(7).default(5),
      /** FMCSA 60 hours in 7 days. */
      maxWeeklyHours: z.number().min(20).max(100).default(60),
      weeklyOvertimeWarnHours: z.number().min(1).max(60).default(10),
    })
    .prefault({}),
  assist: z.object({ escalationMinutes: z.number().int().min(1).max(60).default(5) }).prefault({}),
  kiosk: z
    .object({
      maxPinAttempts: z.number().int().min(3).max(10).default(5),
      lockoutMinutes: z.number().int().min(1).max(120).default(15),
      idleResetSeconds: z.number().int().min(4).max(60).default(8),
      theme: z.enum(["dark", "light"]).default("dark"),
    })
    .prefault({}),
  notifications: z.object({ email: z.boolean().default(false) }).prefault({}),
  gps: z
    .object({
      retentionDays: z.number().int().min(1).max(365).default(30),
      intervalSeconds: z.number().int().min(5).max(120).default(10),
    })
    .prefault({}),
  readiness: z
    .object({
      lowFuelPercent: z.number().int().min(0).max(100).default(25),
      evChargePercent: z.number().int().min(0).max(100).default(50),
    })
    .prefault({}),
});

export type OrgSettings = z.infer<typeof orgSettingsSchema>;

/** Parse stored settings, falling back to defaults for anything missing or invalid. */
export function readSettings(raw: unknown): OrgSettings {
  const parsed = orgSettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : orgSettingsSchema.parse({});
}
