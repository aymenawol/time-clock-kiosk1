import { fuelFilters, loadFuelLogs } from "@/components/fleet/fuel-query";
import { loadPeople } from "@/components/records/people";
import { requireAuth } from "@/lib/auth/session";
import { toCsv } from "@/lib/labor/payroll";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth("fuelLog");
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const f = fuelFilters(auth, sp);
  const [logs, vehiclesRes, people] = await Promise.all([
    loadFuelLogs(auth, f, 5000),
    auth.supabase.from("vehicles").select("id, number").eq("organization_id", auth.org.id),
    loadPeople(auth),
  ]);
  const numbers = new Map((vehiclesRes.data ?? []).map((v) => [v.id, v.number]));
  const csv = toCsv([
    ["Date", "Vehicle", "Service", "Before %", "After %", "Quantity", "Unit", "Odometer", "By", "Notes"],
    ...logs.map((l) => [
      l.created_at,
      numbers.get(l.vehicle_id) ?? "",
      l.service,
      l.energy_before,
      l.energy_after,
      l.quantity,
      l.service === "charge" ? "kWh" : l.service === "fuel" ? "gal" : "",
      l.odometer,
      people.name(l.employee_id),
      l.notes,
    ]),
  ]);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="fuel-log-${f.from}-to-${f.to}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
