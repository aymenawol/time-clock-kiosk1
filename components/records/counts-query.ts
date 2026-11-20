import "server-only";
import type { AuthContext } from "@/lib/auth/session";
import { toSheetColumn, type SlotBreak } from "@/lib/counts/sheet";

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
      .select("id, name, code, count_group, count_label")
      .eq("organization_id", org.id)
      .eq("is_count_column", true)
      .order("sort")
      .order("name"),
    supabase.from("vehicles").select("id, number").eq("organization_id", org.id),
    supabase.from("routes").select("id, name").eq("organization_id", org.id),
  ]);
  const sheets = sheetsRes.data ?? [];
  const shiftIds = [...new Set(sheets.map((s) => s.shift_id))];
  const [shiftsRes, breaksRes] = shiftIds.length
    ? await Promise.all([
        supabase
          .from("shifts")
          .select("id, scheduled_start, scheduled_end, clock_in_at, clock_out_at")
          .eq("organization_id", org.id)
          .in("id", shiftIds),
        supabase
          .from("breaks")
          .select("shift_id, kind, sequence, planned_minutes, window_start")
          .eq("organization_id", org.id)
          .eq("kind", "rest")
          .in("shift_id", shiftIds)
          .order("sequence"),
      ])
    : [{ data: [] }, { data: [] }];
  const breaksByShift = new Map<string, SlotBreak[]>();
  for (const b of breaksRes.data ?? []) breaksByShift.set(b.shift_id, [...(breaksByShift.get(b.shift_id) ?? []), b]);
  return {
    sheets,
    columns: (locationsRes.data ?? []).map(toSheetColumn),
    shiftById: new Map((shiftsRes.data ?? []).map((sh) => [sh.id, sh])),
    breaksByShift,
    vehicleNumber: new Map((vehiclesRes.data ?? []).map((v) => [v.id, v.number])),
    routeName: new Map((routesRes.data ?? []).map((r) => [r.id, r.name])),
  };
}

export const rowTotal = (row: CountRow, columnIds: string[]) => columnIds.reduce((n, id) => n + (row.counts[id] ?? 0), 0);
