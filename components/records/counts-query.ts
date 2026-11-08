import "server-only";
import type { AuthContext } from "@/lib/auth/session";

export interface CountRow {
  departure_time: string;
  counts: Record<string, number>;
}

/** Defensive read of count_sheets.rows (jsonb). */
export function parseRows(json: unknown): CountRow[] {
  if (!Array.isArray(json)) return [];
  return json.map((r) => {
    const o = (r ?? {}) as { departure_time?: unknown; counts?: unknown };
    const counts: Record<string, number> = {};
    if (o.counts && typeof o.counts === "object") {
      for (const [k, v] of Object.entries(o.counts as Record<string, unknown>)) {
        const n = Number(v);
        if (Number.isFinite(n)) counts[k] = n;
      }
    }
    return { departure_time: typeof o.departure_time === "string" ? o.departure_time : "", counts };
  });
}

export async function loadCountSheets(auth: AuthContext, date: string) {
  const { supabase, org } = auth;
  const [sheetsRes, locationsRes, vehiclesRes, routesRes] = await Promise.all([
    supabase
      .from("count_sheets")
      .select("*")
      .eq("organization_id", org.id)
      .eq("work_date", date)
      .order("created_at"),
    supabase
      .from("locations")
      .select("id, name, code")
      .eq("organization_id", org.id)
      .eq("is_count_column", true)
      .order("sort")
      .order("name"),
    supabase.from("vehicles").select("id, number").eq("organization_id", org.id),
    supabase.from("routes").select("id, name").eq("organization_id", org.id),
  ]);
  return {
    sheets: sheetsRes.data ?? [],
    columns: locationsRes.data ?? [],
    vehicleNumber: new Map((vehiclesRes.data ?? []).map((v) => [v.id, v.number])),
    routeName: new Map((routesRes.data ?? []).map((r) => [r.id, r.name])),
  };
}

export const rowTotal = (row: CountRow, columnIds: string[]) => columnIds.reduce((n, id) => n + (row.counts[id] ?? 0), 0);
