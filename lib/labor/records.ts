import type { Tables } from "@/lib/supabase/types";
import type { ShiftRecord } from "./types";

type ShiftRow = Pick<Tables<"shifts">, "id" | "employee_id" | "clock_in_at" | "clock_out_at" | "work_date"> & {
  breaks?: Pick<Tables<"breaks">, "kind" | "paid" | "started_at" | "ended_at">[] | null;
};

/** Map shift rows (with their breaks) to the labor module's records. */
export function toShiftRecords(rows: ShiftRow[]): ShiftRecord[] {
  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employee_id,
    clockIn: new Date(r.clock_in_at),
    clockOut: r.clock_out_at ? new Date(r.clock_out_at) : null,
    workDate: r.work_date,
    breaks: (r.breaks ?? []).map((b) => ({
      kind: b.kind,
      paid: b.paid,
      start: b.started_at ? new Date(b.started_at) : null,
      end: b.ended_at ? new Date(b.ended_at) : null,
    })),
  }));
}

/** Select string for shifts with the break fields the labor module needs. */
export const SHIFT_WITH_BREAKS = "id, employee_id, clock_in_at, clock_out_at, work_date, breaks(kind, paid, started_at, ended_at)";
