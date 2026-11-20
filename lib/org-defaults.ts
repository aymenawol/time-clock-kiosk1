import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";

/**
 * Product defaults every organization starts with, shared by scripts/seed.ts
 * and the /platform "create company" action. Reference data only: no people,
 * vehicles, shifts or locations (those are per customer). Without radio codes
 * drivers have no status buttons, without checklist items inspections are
 * empty, and without chat rooms nobody can chat.
 */

/**
 * The paper "VEHICLE INSPECTION" form (RAC DVIR 40FT Gillig), in paper order.
 * paper_column: left (1) or right (2) column of its section. mini: starred,
 * also checked on the post-trip. pre_trip_only: shaded post-trip box. critical:
 * an X takes the vehicle out of service (not on the paper; owner-approved
 * assumption: lights, signals, doors, emergency exits, tires, glass, horn,
 * steering, parking brake and every brake check).
 */
export const CHECKLIST: {
  category: string;
  label: string;
  critical: boolean;
  paper_column: 1 | 2;
  mini: boolean;
  psi: boolean;
  subgroup: string | null;
  pre_trip_only: boolean;
  hint: string | null;
}[] = [
  { category: "Vehicle Exterior Checks", label: "All lights & lenses", critical: true, paper_column: 1, mini: true, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Exterior Checks", label: "Turn signals & 4-way flashers", critical: true, paper_column: 1, mini: true, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Exterior Checks", label: "Windshield wipers & washers", critical: false, paper_column: 1, mini: false, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Exterior Checks", label: "Door operation, seals intact/tight", critical: true, paper_column: 1, mini: false, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Exterior Checks", label: "Emergency door/windows", critical: true, paper_column: 1, mini: false, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Exterior Checks", label: "Tires, wheels & lugnuts", critical: true, paper_column: 2, mini: true, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Exterior Checks", label: "Glass & mirrors", critical: true, paper_column: 2, mini: true, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Exterior Checks", label: "Body damage/lettering/decals", critical: false, paper_column: 2, mini: false, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Exterior Checks", label: "Under vehicle leaks", critical: false, paper_column: 2, mini: true, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Exterior Checks", label: "Passenger ramp operation", critical: false, paper_column: 2, mini: false, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Interior Checks", label: "Speedometer/instruments", critical: false, paper_column: 1, mini: false, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Interior Checks", label: "Heaters, defroster & ventilation", critical: false, paper_column: 1, mini: false, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Interior Checks", label: "Air conditioner", critical: false, paper_column: 1, mini: false, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Interior Checks", label: "All gauges", critical: false, paper_column: 1, mini: true, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Interior Checks", label: "Horn/dashlights/hi/lo/indicator", critical: true, paper_column: 1, mini: true, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Interior Checks", label: "Operator seat operation & belt", critical: false, paper_column: 1, mini: false, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Interior Checks", label: "Passenger seat securement", critical: false, paper_column: 1, mini: false, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Interior Checks", label: "Handrails", critical: false, paper_column: 1, mini: false, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Interior Checks", label: "2-way radio operation", critical: false, paper_column: 1, mini: false, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Interior Checks", label: "Steering operation", critical: true, paper_column: 1, mini: false, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Interior Checks", label: "Front Monitor", critical: false, paper_column: 1, mini: true, psi: false, subgroup: null, pre_trip_only: false, hint: "(Screens, Cables, Housing)" },
  { category: "Vehicle Interior Checks", label: "Fire Ext./Triangles/First aid kit", critical: false, paper_column: 2, mini: false, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Interior Checks", label: "Accident Packet", critical: false, paper_column: 2, mini: false, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Interior Checks", label: "Vehicle Insurance & Reg.", critical: false, paper_column: 2, mini: false, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Interior Checks", label: "Wheelchair securement straps", critical: false, paper_column: 2, mini: false, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Interior Checks", label: "Exhaust noise", critical: false, paper_column: 2, mini: false, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Interior Checks", label: "Parking brake", critical: true, paper_column: 2, mini: false, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Interior Checks", label: "Interior clean", critical: false, paper_column: 2, mini: false, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Interior Checks", label: "Interior lights", critical: false, paper_column: 2, mini: false, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Interior Checks", label: "Destination sign", critical: false, paper_column: 2, mini: false, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Interior Checks", label: "Backup alarm", critical: false, paper_column: 2, mini: false, psi: false, subgroup: null, pre_trip_only: false, hint: null },
  { category: "Vehicle Interior Checks", label: "Rear Monitor", critical: false, paper_column: 2, mini: true, psi: false, subgroup: null, pre_trip_only: false, hint: "(Screens, Cables, Housing)" },
  { category: "Brake System Checks", label: "Cut In pressure", critical: true, paper_column: 1, mini: false, psi: true, subgroup: "AIR", pre_trip_only: true, hint: null },
  { category: "Brake System Checks", label: "Cut out pressure", critical: true, paper_column: 1, mini: false, psi: true, subgroup: "AIR", pre_trip_only: true, hint: null },
  { category: "Brake System Checks", label: "Static press, loss P/B on", critical: true, paper_column: 1, mini: false, psi: true, subgroup: "AIR", pre_trip_only: true, hint: null },
  { category: "Brake System Checks", label: "Static press, loss P/B off", critical: true, paper_column: 1, mini: false, psi: true, subgroup: "AIR", pre_trip_only: true, hint: null },
  { category: "Brake System Checks", label: "Applied pressure loss", critical: true, paper_column: 2, mini: false, psi: true, subgroup: null, pre_trip_only: true, hint: null },
  { category: "Brake System Checks", label: "Low pressure warning", critical: true, paper_column: 2, mini: true, psi: true, subgroup: null, pre_trip_only: true, hint: null },
  { category: "Brake System Checks", label: "Auto pop out (park brake)", critical: true, paper_column: 2, mini: false, psi: true, subgroup: null, pre_trip_only: true, hint: null },
  { category: "Brake System Checks", label: "Park brake hold", critical: true, paper_column: 2, mini: false, psi: true, subgroup: null, pre_trip_only: true, hint: null },
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
    .insert(CHECKLIST.map((c, i) => ({ organization_id: organizationId, ...c, sort: i + 1 })));
  if (items.error) throw items.error;
  const rooms = await db.from("chat_rooms").insert(CHAT_ROOMS.map((r) => ({ organization_id: organizationId, ...r })));
  if (rooms.error) throw rooms.error;
}
