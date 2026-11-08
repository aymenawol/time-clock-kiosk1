import "server-only";
import { subDays } from "date-fns";
import type { ServerClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/supabase/types";

export interface Performance {
  shifts: number;
  hours: number;
  breaksMissed: number;
  breaksOverrun: number;
  /** null when there is nothing to measure (no shifts with a vehicle). */
  inspectionPct: number | null;
  countSheetPct: number | null;
  safetyPct: number | null;
  safetyEligible: number;
}

const pct = (done: number, total: number) => (total === 0 ? null : Math.min(100, Math.round((done / total) * 100)));

/** Last 90 days of the employee's own work, computed from RLS-scoped queries. */
export async function getPerformance(
  supabase: ServerClient,
  organizationId: string,
  employeeId: string,
  role: AppRole,
): Promise<Performance> {
  const since = subDays(new Date(), 90).toISOString();
  const now = new Date().toISOString();

  const [shiftsRes, breaksRes, inspRes, countRes, meetingsRes, attRes] = await Promise.all([
    supabase
      .from("shifts")
      .select("id, clock_in_at, clock_out_at, vehicle_id")
      .eq("organization_id", organizationId)
      .eq("employee_id", employeeId)
      .eq("status", "completed")
      .gte("clock_in_at", since)
      .limit(1000),
    supabase
      .from("breaks")
      .select("status")
      .eq("organization_id", organizationId)
      .eq("employee_id", employeeId)
      .in("status", ["missed", "overrun"])
      .gte("created_at", since)
      .limit(1000),
    supabase
      .from("inspections")
      .select("shift_id")
      .eq("organization_id", organizationId)
      .eq("employee_id", employeeId)
      .not("submitted_at", "is", null)
      .gte("created_at", since)
      .limit(2000),
    supabase
      .from("count_sheets")
      .select("shift_id")
      .eq("organization_id", organizationId)
      .eq("employee_id", employeeId)
      .eq("status", "submitted")
      .gte("created_at", since)
      .limit(1000),
    supabase
      .from("safety_meetings")
      .select("id, audience")
      .eq("organization_id", organizationId)
      .neq("status", "cancelled")
      .gte("starts_at", since)
      .lt("starts_at", now)
      .limit(500),
    supabase
      .from("safety_attendance")
      .select("meeting_id, status")
      .eq("organization_id", organizationId)
      .eq("employee_id", employeeId)
      .in("status", ["present", "late"])
      .limit(500),
  ]);

  const shifts = shiftsRes.data ?? [];
  const hours = shifts.reduce(
    (sum, s) => sum + (s.clock_out_at ? (new Date(s.clock_out_at).getTime() - new Date(s.clock_in_at).getTime()) / 3_600_000 : 0),
    0,
  );
  const withVehicle = new Set(shifts.filter((s) => s.vehicle_id).map((s) => s.id));
  const insp = (inspRes.data ?? []).filter((i) => withVehicle.has(i.shift_id)).length;
  const counts = (countRes.data ?? []).filter((c) => withVehicle.has(c.shift_id)).length;

  const eligible = (meetingsRes.data ?? []).filter((m) => m.audience.length === 0 || m.audience.includes(role));
  const eligibleIds = new Set(eligible.map((m) => m.id));
  const attended = (attRes.data ?? []).filter((a) => eligibleIds.has(a.meeting_id)).length;

  const breaks = breaksRes.data ?? [];
  return {
    shifts: shifts.length,
    hours,
    breaksMissed: breaks.filter((b) => b.status === "missed").length,
    breaksOverrun: breaks.filter((b) => b.status === "overrun").length,
    inspectionPct: pct(insp, withVehicle.size * 2),
    countSheetPct: pct(counts, withVehicle.size),
    safetyPct: pct(attended, eligible.length),
    safetyEligible: eligible.length,
  };
}
