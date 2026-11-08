import "server-only";
import type { AuthContext } from "@/lib/auth/session";
import { todayIn } from "@/lib/format";
import { startOfLocalDate } from "@/lib/labor/time";
import type { Tables } from "@/lib/supabase/types";

export type FieldVehicle = Pick<
  Tables<"vehicles">,
  "id" | "number" | "vehicle_type" | "powertrain" | "status" | "energy_level" | "odometer"
>;

export type ActiveShift = Tables<"shifts"> & {
  vehicle: FieldVehicle | null;
  route: Pick<Tables<"routes">, "id" | "name" | "color"> | null;
};

const SHIFT_SELECT =
  "*, vehicle:vehicles(id, number, vehicle_type, powertrain, status, energy_level, odometer), route:routes(id, name, color)";

/** The caller's open shift in the active organization, with vehicle and route. */
export async function getActiveShift(auth: AuthContext): Promise<ActiveShift | null> {
  const { data, error } = await auth.supabase
    .from("shifts")
    .select(SHIFT_SELECT)
    .eq("organization_id", auth.org.id)
    .eq("employee_id", auth.employee.id)
    .eq("status", "active")
    .order("clock_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ActiveShift | null) ?? null;
}

/** The caller's most recent closed shift. */
export async function getLastShift(auth: AuthContext) {
  const { data } = await auth.supabase
    .from("shifts")
    .select("id, work_date, clock_in_at, clock_out_at, vehicle:vehicles(number)")
    .eq("organization_id", auth.org.id)
    .eq("employee_id", auth.employee.id)
    .eq("status", "completed")
    .order("clock_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/** ISO instant of local midnight today in the organization time zone. */
export function startOfToday(auth: AuthContext): string {
  return startOfLocalDate(todayIn(auth.org.timezone), auth.org.timezone).toISOString();
}

/** Server-side "now" (kept out of component bodies so render stays pure). */
export function serverNow(): number {
  return Date.now();
}

export function energyNoun(powertrain: string | null | undefined): "Battery" | "Fuel" {
  return powertrain === "ev" ? "Battery" : "Fuel";
}
