import { z } from 'zod'

const hours = z.number().min(0).max(24)

// Allow-listed, bounded daily-hours corrections (.strict() blocks mass-assignment).
export const DailyHoursCorrectionSchema = z
  .object({
    regular_hours: hours.optional(),
    overtime_hours: hours.optional(),
    pto_hours: hours.optional(),
    fmla_hours: hours.optional(),
  })
  .strict()
