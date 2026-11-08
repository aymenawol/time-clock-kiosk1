import "server-only";
import type { AuthContext } from "@/lib/auth/session";
import type { Place } from "./geo";

/** Shift fields the board, sign-in sheet and compliance pages share. */
export const SHIFT_OPS_SELECT = `id, employee_id, work_date, status, clock_in_at, clock_out_at, source_in, source_out,
  scheduled_start, scheduled_end, radio_status, radio_status_at, vehicle_id, tablet_id, route_id, meal_waived,
  compliance_verdict, compliance_note, compliance_at,
  employee:employees!shifts_employee_id_fkey(id, first_name, last_name, employee_number, role),
  vehicle:vehicles(id, number, status, powertrain, energy_level),
  tablet:tablets(id, number),
  route:routes(id, name, color, stop_ids),
  breaks(id, kind, paid, sequence, planned_minutes, window_start, window_end, started_at, ended_at, status, reopened_at)`;

export async function loadActiveShifts(auth: AuthContext) {
  const { data, error } = await auth.supabase
    .from("shifts")
    .select(SHIFT_OPS_SELECT)
    .eq("organization_id", auth.org.id)
    .eq("status", "active")
    .order("clock_in_at");
  if (error) throw error;
  return data ?? [];
}

export type OpsShift = Awaited<ReturnType<typeof loadActiveShifts>>[number];
export type OpsBreak = OpsShift["breaks"][number];

export async function loadShiftsForDate(auth: AuthContext, ymd: string) {
  const { data, error } = await auth.supabase
    .from("shifts")
    .select(SHIFT_OPS_SELECT)
    .eq("organization_id", auth.org.id)
    .eq("work_date", ymd)
    .neq("status", "void")
    .order("clock_in_at");
  if (error) throw error;
  return data ?? [];
}

/** Active locations (with or without coordinates) and active routes. */
export async function loadPlaces(auth: AuthContext) {
  const [locations, routes] = await Promise.all([
    auth.supabase
      .from("locations")
      .select("id, name, code, kind, lat, lng, radius_m, sort")
      .eq("organization_id", auth.org.id)
      .eq("active", true)
      .order("sort"),
    auth.supabase
      .from("routes")
      .select("id, name, color, stop_ids")
      .eq("organization_id", auth.org.id)
      .eq("active", true)
      .order("name"),
  ]);
  if (locations.error) throw locations.error;
  if (routes.error) throw routes.error;
  return { locations: (locations.data ?? []) satisfies Place[], routes: routes.data ?? [] };
}

/** Stops of a route, in route order, skipping ids that no longer exist. */
export function routeStops<P extends { id: string }>(stopIds: string[] | null | undefined, places: P[]): P[] {
  const byId = new Map(places.map((p) => [p.id, p]));
  return (stopIds ?? []).map((id) => byId.get(id)).filter((p): p is P => Boolean(p));
}

export interface AssignOption {
  id: string;
  label: string;
  /** The active shift currently holding it, if any. */
  busyShiftId: string | null;
  status?: string;
}

/** Vehicles, tablets and routes for the assignment dialog. */
export async function loadAssignOptions(auth: AuthContext) {
  const [vehicles, tablets, routes, active] = await Promise.all([
    auth.supabase
      .from("vehicles")
      .select("id, number, status")
      .eq("organization_id", auth.org.id)
      .eq("active", true)
      .order("number"),
    auth.supabase.from("tablets").select("id, number").eq("organization_id", auth.org.id).eq("active", true).order("number"),
    auth.supabase.from("routes").select("id, name").eq("organization_id", auth.org.id).eq("active", true).order("name"),
    auth.supabase
      .from("shifts")
      .select("id, vehicle_id, tablet_id")
      .eq("organization_id", auth.org.id)
      .eq("status", "active"),
  ]);
  const vehicleBusy = new Map<string, string>();
  const tabletBusy = new Map<string, string>();
  for (const s of active.data ?? []) {
    if (s.vehicle_id) vehicleBusy.set(s.vehicle_id, s.id);
    if (s.tablet_id) tabletBusy.set(s.tablet_id, s.id);
  }
  return {
    vehicles: (vehicles.data ?? []).map<AssignOption>((v) => ({
      id: v.id,
      label: v.number,
      status: v.status,
      busyShiftId: vehicleBusy.get(v.id) ?? null,
    })),
    tablets: (tablets.data ?? []).map<AssignOption>((t) => ({ id: t.id, label: t.number, busyShiftId: tabletBusy.get(t.id) ?? null })),
    routes: (routes.data ?? []).map<AssignOption>((r) => ({ id: r.id, label: r.name, busyShiftId: null })),
  };
}

export type AssignOptions = Awaited<ReturnType<typeof loadAssignOptions>>;
