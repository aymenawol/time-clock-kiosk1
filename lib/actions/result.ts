import type { ZodError } from 'zod'

/**
 * Project-wide Server Action result contract. Discriminated union so callers can
 * handle success/failure uniformly:
 *   const res = await someAction(...)
 *   if (!res.success) { toast(res.error); return }
 *   use(res.data)
 */
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string> }

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data }
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return fieldErrors ? { success: false, error, fieldErrors } : { success: false, error }
}

/** Turn a Zod validation failure into a uniform ActionResult with per-field messages. */
export function failValidation(err: ZodError): { success: false; error: string; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {}
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_'
    if (!fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return { success: false, error: 'Please correct the highlighted fields.', fieldErrors }
}
