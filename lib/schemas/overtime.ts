import { z } from 'zod'

/**
 * Validation for the dispatcher overtime / off-day FormData actions. These
 * actions read raw FormData; without these schemas a bad input (e.g.
 * `Number('abc') → NaN`, negative hours) reached the DB unchecked.
 */

// HH:MM or HH:MM:SS (24h). Times come from <input type="time">.
const timeStr = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Invalid time')
// ISO calendar date (YYYY-MM-DD) from <input type="date">.
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date')

export const PostOtShiftSchema = z.object({
  date: dateStr,
  start_time: timeStr,
  duration_hours: z.number({ invalid_type_error: 'Duration is required' }).positive().max(24),
  slots_available: z.number().int().min(1).max(100),
  description: z.string().trim().max(2000).nullable().optional(),
  bid_close_at: z.string().min(1).nullable().optional(),
})

export const OffDayRequestSchema = z.object({
  employee_id: z.string().uuid('Select a valid employee'),
  requested_date: dateStr,
  message: z.string().trim().max(2000).nullable().optional(),
})
