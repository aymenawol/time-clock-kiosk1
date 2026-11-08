import "server-only";
import type { ServerClient } from "@/lib/supabase/server";

/** Leave balance hours per kind: the sum of the employee's ledger entries. */
export async function getLeaveBalances(
  supabase: ServerClient,
  organizationId: string,
  employeeId: string,
): Promise<Record<string, number>> {
  const { data } = await supabase
    .from("leave_ledger")
    .select("kind, hours")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId);
  const out: Record<string, number> = { pto: 0, vacation: 0, sick: 0, fmla: 0 };
  for (const row of data ?? []) out[row.kind] = (out[row.kind] ?? 0) + Number(row.hours);
  return out;
}

/** "Su Mo Tu" from weekday numbers (0 = Sunday). */
export function weekdayList(days: number[]): string {
  const names = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  return [...days].sort((a, b) => a - b).map((d) => names[d]).join(" ");
}

/** "06:30:00" -> Date-free "6:30 AM" (or 24h). */
export function fmtClock(time: string | null | undefined, clock24h: boolean): string {
  if (!time) return "-";
  const [h, m] = time.split(":").map(Number);
  if (clock24h) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Current time in ms. Wrapped so server pages can read the clock (they render per request). */
export function nowMs(): number {
  return Date.now();
}
