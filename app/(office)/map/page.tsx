import type { Metadata } from "next";
import { serverNow } from "@/components/ops/time";
import { loadPlaces, routeStops } from "@/components/ops/queries";
import { LiveRefresh } from "@/components/realtime/use-live-refresh";
import { PageHeader } from "@/components/ui/misc";
import { requireAuth } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { fullName } from "@/lib/format";
import { LiveMap, type MapPosition, type MapRoute, type MapVehicle } from "./_components/live-map";

export const metadata: Metadata = { title: "Live map" };

export default async function MapPage() {
  const auth = await requireAuth("map");
  const db = auth.supabase;
  const org = auth.org.id;

  const [shifts, places, positions] = await Promise.all([
    db
      .from("shifts")
      .select(
        "id, employee_id, vehicle:vehicles!inner(id, number, status), employee:employees!shifts_employee_id_fkey(first_name, last_name), route:routes(id, name, color)",
      )
      .eq("organization_id", org)
      .eq("status", "active")
      .not("vehicle_id", "is", null),
    loadPlaces(auth),
    db
      .from("vehicle_latest_positions")
      .select("vehicle_id, shift_id, employee_id, lat, lng, speed_mps, heading, recorded_at")
      .eq("organization_id", org),
  ]);

  const vehicles: MapVehicle[] = (shifts.data ?? [])
    .map((s) => ({
      vehicleId: s.vehicle.id,
      number: s.vehicle.number,
      status: s.vehicle.status,
      shiftId: s.id,
      employeeId: s.employee_id,
      driverName: fullName(s.employee),
      routeName: s.route?.name ?? null,
      routeColor: s.route?.color ?? null,
    }))
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));

  const routes: MapRoute[] = places.routes.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    path: routeStops(r.stop_ids, places.locations)
      .filter((p) => p.lat !== null && p.lng !== null)
      .map((p) => ({ lat: p.lat as number, lng: p.lng as number })),
  }));

  return (
    <>
      <LiveRefresh organizationId={org} tables={["shifts", "vehicles"]} debounceMs={1500} />
      <PageHeader title="Live map" description="Vehicles on active shifts. Positions update as drivers report GPS." />
      <LiveMap
        organizationId={org}
        apiKey={publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null}
        vehicles={vehicles}
        positions={(positions.data ?? []) satisfies MapPosition[]}
        locations={places.locations}
        routes={routes}
        serverNow={serverNow()}
      />
    </>
  );
}
