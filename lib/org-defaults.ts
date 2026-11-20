import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";

/**
 * Product defaults every organization starts with, shared by scripts/seed.ts
 * and the /platform "create company" action. Reference data only: no people,
 * vehicles, shifts or locations (those are per customer). Without radio codes
 * drivers have no status buttons, without checklist items inspections are
 * empty, and without chat rooms nobody can chat.
 */

// v0 INSPECTION_CHECKLIST (lib/supabase.ts on main), same categories and order.
const CHECKLIST: [string, string, boolean][] = [
  ["Exterior", "Body damage", false],
  ["Exterior", "Mirrors intact", false],
  ["Exterior", "Windows unobstructed", false],
  ["Exterior", "Doors operate properly", true],
  ["Tires", "Adequate tread depth", true],
  ["Tires", "No visible damage", false],
  ["Tires", "Properly inflated", true],
  ["Tires", "No wheel leaks", false],
  ["Lights", "Headlights", true],
  ["Lights", "Taillights", false],
  ["Lights", "Brake lights", true],
  ["Lights", "Turn signals", true],
  ["Lights", "Hazard lights", false],
  ["Lights", "Interior lights", false],
  ["Brake Systems", "Brake pedal firm", true],
  ["Brake Systems", "Air brake gauge normal", true],
  ["Brake Systems", "No unusual brake sounds", true],
  ["Steering", "Steering wheel free play normal", true],
  ["Steering", "No pulling or wandering", true],
  ["Gauges", "Speedometer working", false],
  ["Gauges", "Fuel/charge gauge working", false],
  ["Gauges", "Temperature normal", false],
  ["Gauges", "Oil pressure normal", false],
  ["Interior", "Seats secure and undamaged", false],
  ["Interior", "Seat belts functional", false],
  ["Interior", "Handrails secure", false],
  ["Interior", "Floor clean and unobstructed", false],
  ["Passenger Ramp", "Ramp deploys/retracts properly", true],
  ["Passenger Ramp", "Ramp surface non-slip", false],
  ["Passenger Ramp", "No damage to ramp mechanism", false],
  ["Parking Brake", "Parking brake holds vehicle", true],
  ["Parking Brake", "Parking brake releases fully", true],
  ["Safety Equipment", "Fire extinguisher present and charged", true],
  ["Safety Equipment", "First aid kit present", false],
  ["Safety Equipment", "Emergency triangles present", false],
  ["Safety Equipment", "Emergency exits unobstructed", true],
  ["Mirrors", "All mirrors properly adjusted", false],
  ["Mirrors", "No cracks or obstructions", false],
];

type Role = Database["public"]["Enums"]["app_role"];
type VehicleStatus = Database["public"]["Enums"]["vehicle_status"];

// v0 radio codes: 4 driver buttons, 2 board-only codes.
export const RADIO_CODES: {
  code: string;
  label: string;
  sets_vehicle_status: VehicleStatus | null;
  notify_roles: Role[];
  is_alert: boolean;
  driver_selectable: boolean;
  sort: number;
}[] = [
    { code: "10-8", label: "In Service", sets_vehicle_status: "in_service", notify_roles: ["dispatcher"], is_alert: false, driver_selectable: true, sort: 1 },
    { code: "10-39", label: "On Break", sets_vehicle_status: "in_service", notify_roles: ["dispatcher", "supervisor"], is_alert: false, driver_selectable: true, sort: 2 },
    { code: "10-37", label: "Fueling/Wash", sets_vehicle_status: "needs_fuel", notify_roles: ["dispatcher", "admin", "supervisor"], is_alert: false, driver_selectable: true, sort: 3 },
    { code: "10-7", label: "Out of Service", sets_vehicle_status: "shop", notify_roles: ["dispatcher", "admin"], is_alert: false, driver_selectable: true, sort: 4 },
    { code: "10-51", label: "Assist Needed", sets_vehicle_status: null, notify_roles: ["dispatcher"], is_alert: true, driver_selectable: false, sort: 5 },
    { code: "10-33", label: "HAZARD", sets_vehicle_status: "safety_hold", notify_roles: ["dispatcher", "supervisor"], is_alert: true, driver_selectable: false, sort: 6 },
];

export const CHAT_ROOMS: { name: string; kind: "role"; roles: Role[] }[] = [
    { name: "Dispatch desk", kind: "role", roles: ["admin", "supervisor", "dispatcher", "coordinator"] },
    { name: "All drivers", kind: "role", roles: ["driver", "dispatcher", "supervisor", "admin"] },
    { name: "Fuel and shop", kind: "role", roles: ["fueler", "technician", "dispatcher", "supervisor"] },
    { name: "Supervisors", kind: "role", roles: ["admin", "supervisor"] },
  ];

/** Insert the default radio codes, inspection checklist and chat rooms for an organization. */
export async function seedOrgReferenceData(db: SupabaseClient<Database>, organizationId: string) {
  const radio = await db.from("radio_codes").insert(RADIO_CODES.map((r) => ({ organization_id: organizationId, ...r })));
  if (radio.error) throw radio.error;
  const items = await db
    .from("checklist_items")
    .insert(CHECKLIST.map(([category, label, critical], i) => ({ organization_id: organizationId, category, label, critical, sort: i })));
  if (items.error) throw items.error;
  const rooms = await db.from("chat_rooms").insert(CHAT_ROOMS.map((r) => ({ organization_id: organizationId, ...r })));
  if (rooms.error) throw rooms.error;
}
