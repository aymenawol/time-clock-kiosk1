import type { AppRole } from "@/lib/supabase/types";

export const ROLES = [
  "admin",
  "supervisor",
  "dispatcher",
  "coordinator",
  "driver",
  "fueler",
  "technician",
] as const satisfies readonly AppRole[];

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  dispatcher: "Dispatcher",
  coordinator: "Coordinator",
  driver: "Driver",
  fueler: "Fueler",
  technician: "Technician",
};

export const OFFICE_ROLES = ["admin", "supervisor", "dispatcher", "coordinator"] as const satisfies readonly AppRole[];
export const FIELD_ROLES = ["driver", "fueler", "technician"] as const satisfies readonly AppRole[];

const ALL = ROLES;
const OPS = ["admin", "supervisor", "dispatcher"] as const;
const STAFF = ["admin", "supervisor", "dispatcher", "coordinator"] as const;
const LEADS = ["admin", "supervisor"] as const;

/**
 * The single permission matrix. Sidebar items, page guards, server-action
 * guards and the e2e tests all read from here. RLS enforces the same rules in
 * the database (see supabase/migrations).
 */
export const CAPABILITIES = {
  dashboard: LEADS,
  board: STAFF,
  map: OPS,
  signInSheet: STAFF,
  signInSheetAssign: OPS,
  assists: OPS,
  compliance: STAFF,
  complianceVerdict: ["admin", "supervisor", "coordinator"],
  breakReopen: OPS,
  emergencyView: ALL,
  emergencyTrigger: LEADS,
  chat: ALL,
  chatManage: LEADS,
  fleet: OPS,
  fleetEdit: ["admin"],
  vehicleStatus: OPS,
  readiness: OPS,
  inspections: OPS,
  defects: OPS,
  defectsWork: ["admin", "supervisor", "technician"],
  fuelLog: LEADS,
  people: LEADS,
  peopleEdit: ["admin"],
  timesheets: LEADS,
  forms: LEADS,
  safety: ["admin", "supervisor", "coordinator"],
  safetyManage: LEADS,
  performance: LEADS,
  fatigue: OPS,
  bids: ["admin"],
  overtime: OPS,
  payroll: ["admin"],
  counts: STAFF,
  countsEdit: OPS,
  lostFound: STAFF,
  reports: LEADS,
  notificationsLog: ["admin"],
  settings: ["admin"],
  // Field app
  field: ALL,
  shiftCard: ALL,
  driving: ["driver"],
  fuelQueue: ["admin", "supervisor", "fueler"],
  defectQueue: ["admin", "supervisor", "technician"],
} as const satisfies Record<string, readonly AppRole[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: AppRole | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return (CAPABILITIES[capability] as readonly AppRole[]).includes(role);
}

export function isOfficeRole(role: AppRole): boolean {
  return (OFFICE_ROLES as readonly AppRole[]).includes(role);
}

/** Where each role lands after sign-in. */
export function homeFor(role: AppRole): string {
  switch (role) {
    case "admin":
    case "supervisor":
      return "/dashboard";
    case "dispatcher":
      return "/board";
    case "coordinator":
      return "/compliance";
    default:
      return "/m";
  }
}
