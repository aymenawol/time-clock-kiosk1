import "server-only";
import type { AuthContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PinStatus {
  pinSet: boolean;
  pinSetAt: string | null;
  failedCount: number;
  lockedUntil: string | null;
}

/**
 * Kiosk PIN state per employee. employee_credentials has no RLS policies, so
 * this reads it with the service role, and only for admins. Returns null for
 * everyone else (the UI then shows a dash).
 */
export async function loadPinStatus(auth: AuthContext, employeeIds?: string[]): Promise<Map<string, PinStatus> | null> {
  if (auth.employee.role !== "admin") return null;
  let q = createAdminClient()
    .from("employee_credentials")
    .select("employee_id, pin_hash, pin_set_at, failed_count, locked_until")
    .eq("organization_id", auth.org.id);
  if (employeeIds) q = q.in("employee_id", employeeIds);
  const { data } = await q.limit(5000);
  return new Map(
    (data ?? []).map((r) => [
      r.employee_id,
      { pinSet: Boolean(r.pin_hash), pinSetAt: r.pin_set_at, failedCount: r.failed_count, lockedUntil: r.locked_until },
    ]),
  );
}
