import "server-only";
import type { AuthContext } from "@/lib/auth/session";
import type { PaperItem, ResultEntry } from "@/lib/inspection";
import { parseResults } from "@/lib/inspection";
import type { Tables } from "@/lib/supabase/types";

type Db = AuthContext["supabase"];
export type InspectionRow = Tables<"inspections">;

export const ITEM_COLUMNS = "id, category, label, critical, sort, paper_column, mini, psi, subgroup, pre_trip_only, hint";

export interface PreviousReport {
  id: string;
  kind: "pre_trip" | "post_trip";
  employee_id: string;
  submitted_at: string;
  notes: string | null;
  results: ResultEntry[];
  operatorName: string;
}

/**
 * The most recent submitted inspection for this vehicle by someone other than
 * `employeeId`. RLS lets a driver read submitted inspections of the vehicle
 * they are clocked in on (inspections_select_current_vehicle).
 */
export async function findPreviousReport(
  db: Db,
  organizationId: string,
  vehicleId: string,
  employeeId: string,
): Promise<PreviousReport | null> {
  const { data } = await db
    .from("inspections")
    .select("id, kind, employee_id, submitted_at, notes, results")
    .eq("organization_id", organizationId)
    .eq("vehicle_id", vehicleId)
    .neq("employee_id", employeeId)
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data || !data.submitted_at) return null;
  const { data: emp } = await db.from("employees").select("first_name, last_name").eq("id", data.employee_id).maybeSingle();
  return {
    id: data.id,
    kind: data.kind as "pre_trip" | "post_trip",
    employee_id: data.employee_id,
    submitted_at: data.submitted_at,
    notes: data.notes,
    results: parseResults(data.results),
    operatorName: emp ? `${emp.first_name} ${emp.last_name}` : "Another driver",
  };
}

export interface SheetData {
  /** The inspection that owns the header, signatures and sign-off: the pre-trip when there is one. */
  primary: InspectionRow;
  pre: InspectionRow | null;
  post: InspectionRow | null;
  vehicle: { id: string; number: string; vehicle_type: string } | null;
  shift: Pick<Tables<"shifts">, "clock_in_at" | "clock_out_at" | "radio_status" | "radio_status_at" | "in_service_at" | "work_date"> | null;
  items: PaperItem[];
  names: Record<string, string>;
}

/** Load one inspection with its shift's other half, items, vehicle and names. */
export async function loadInspectionSheet(db: Db, organizationId: string, id: string): Promise<SheetData | null> {
  const { data: inspection } = await db
    .from("inspections")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!inspection) return null;

  let rows: InspectionRow[] = [inspection];
  if (inspection.shift_id) {
    const { data } = await db
      .from("inspections")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("shift_id", inspection.shift_id);
    if (data?.length) rows = data;
  }
  const pre = rows.find((r) => r.kind === "pre_trip") ?? null;
  const post = rows.find((r) => r.kind === "post_trip") ?? null;
  const primary = pre ?? post ?? inspection;

  const itemIds = new Set<string>();
  for (const r of rows) for (const e of parseResults(r.results)) itemIds.add(e.item_id);
  const peopleIds = new Set<string>();
  for (const r of rows) {
    peopleIds.add(r.employee_id);
    if (r.next_reviewed_by) peopleIds.add(r.next_reviewed_by);
    if (r.technician_signed_by) peopleIds.add(r.technician_signed_by);
  }

  const [vehicleRes, shiftRes, itemsRes, peopleRes] = await Promise.all([
    db.from("vehicles").select("id, number, vehicle_type").eq("id", primary.vehicle_id).maybeSingle(),
    inspection.shift_id
      ? db
          .from("shifts")
          .select("clock_in_at, clock_out_at, radio_status, radio_status_at, in_service_at, work_date")
          .eq("id", inspection.shift_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    itemIds.size
      ? db.from("checklist_items").select(ITEM_COLUMNS).eq("organization_id", organizationId).in("id", [...itemIds])
      : Promise.resolve({ data: [] }),
    db.from("employees").select("id, first_name, last_name").eq("organization_id", organizationId).in("id", [...peopleIds]),
  ]);

  const names: Record<string, string> = {};
  for (const p of peopleRes.data ?? []) names[p.id] = `${p.first_name} ${p.last_name}`;

  return {
    primary,
    pre,
    post,
    vehicle: vehicleRes.data ?? null,
    shift: shiftRes.data ?? null,
    items: ((itemsRes.data ?? []) as PaperItem[]).sort((a, b) => a.sort - b.sort),
    names,
  };
}
