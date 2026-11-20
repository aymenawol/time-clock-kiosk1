import "server-only";
import type { AuthContext } from "@/lib/auth/session";

const SELECT = `id, work_date, status, clock_in_at, clock_out_at, scheduled_start, scheduled_end, radio_status,
  vehicle_id, tablet_id, route_id, meal_waived, kiosk_in_device_id,
  employee:employees!shifts_employee_id_fkey(id, first_name, last_name, employee_number, seniority_number),
  vehicle:vehicles(id, number, powertrain),
  tablet:tablets(id, number),
  device:kiosk_devices!shifts_kiosk_in_device_id_fkey(id, name)`;

/** Shifts for a local date, in seniority order like the paper sheet. */
export async function loadSignInSheet(auth: AuthContext, ymd: string) {
  const { data, error } = await auth.supabase
    .from("shifts")
    .select(SELECT)
    .eq("organization_id", auth.org.id)
    .eq("work_date", ymd)
    .neq("status", "void")
    .order("clock_in_at");
  if (error) throw error;
  return [...(data ?? [])].sort(
    (a, b) =>
      (a.employee.seniority_number ?? Number.MAX_SAFE_INTEGER) - (b.employee.seniority_number ?? Number.MAX_SAFE_INTEGER) ||
      a.clock_in_at.localeCompare(b.clock_in_at),
  );
}

export type SignInRow = Awaited<ReturnType<typeof loadSignInSheet>>[number];

export interface BreakSlot {
  id: string;
  shift_id: string;
  sequence: number;
  kind: string;
  planned_minutes: number;
  window_start: string | null;
  status: string;
  started_at: string | null;
}

/** Planned rest breaks (the paper's BRK Windows) for the given shifts, by shift id. */
export async function loadBreakSlots(auth: AuthContext, shiftIds: string[]): Promise<Map<string, BreakSlot[]>> {
  const out = new Map<string, BreakSlot[]>();
  if (!shiftIds.length) return out;
  const { data, error } = await auth.supabase
    .from("breaks")
    .select("id, shift_id, sequence, kind, planned_minutes, window_start, status, started_at")
    .eq("organization_id", auth.org.id)
    .eq("kind", "rest")
    .in("shift_id", shiftIds)
    .order("sequence");
  if (error) throw error;
  for (const b of data ?? []) out.set(b.shift_id, [...(out.get(b.shift_id) ?? []), b]);
  return out;
}
