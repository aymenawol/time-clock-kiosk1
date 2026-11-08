import "server-only";
import { dayRange, isYmd, param } from "@/components/records/params";
import type { AuthContext } from "@/lib/auth/session";
import { localDate } from "@/lib/labor/time";

export function fuelFilters(auth: AuthContext, sp: Record<string, string | string[] | undefined>) {
  const tz = auth.org.timezone;
  const to = isYmd(param(sp, "to")) ? param(sp, "to") : localDate(Date.now(), tz);
  const fromDefault = localDate(Date.now() - 29 * 86_400_000, tz);
  const from = isYmd(param(sp, "from")) ? param(sp, "from") : fromDefault;
  const vehicle = /^[0-9a-f-]{36}$/i.test(param(sp, "vehicle")) ? param(sp, "vehicle") : "";
  const service = ["fuel", "wash", "charge"].includes(param(sp, "service")) ? param(sp, "service") : "";
  return { from, to, vehicle, service };
}

export async function loadFuelLogs(auth: AuthContext, f: ReturnType<typeof fuelFilters>, limit: number) {
  const { start, end } = dayRange(f.from, f.to, auth.org.timezone);
  let query = auth.supabase
    .from("fuel_logs")
    .select("*")
    .eq("organization_id", auth.org.id)
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (f.vehicle) query = query.eq("vehicle_id", f.vehicle);
  if (f.service) query = query.eq("service", f.service);
  return (await query).data ?? [];
}
