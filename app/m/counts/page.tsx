import { AlertTriangle, Clock, Table2 } from "lucide-react";
import { getActiveShift } from "@/components/field/data";
import { FieldHeader, Notice } from "@/components/field/field-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { requireAuth } from "@/lib/auth/session";
import { toSheetColumn, lastFirst, fmtPaperTime, stampLabel, formatBreakWindows } from "@/lib/counts/sheet";
import { fmtDateTime, fmtLocalDate } from "@/lib/format";
import { CountSheet, type CountRow } from "./count-sheet";

export const metadata = { title: "Counting sheet" };

function parseRows(raw: unknown): CountRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => {
    const o = (r ?? {}) as { departure_time?: unknown; counts?: unknown };
    const counts: Record<string, number> = {};
    if (o.counts && typeof o.counts === "object") {
      for (const [k, v] of Object.entries(o.counts as Record<string, unknown>)) if (typeof v === "number") counts[k] = v;
    }
    return { departure_time: typeof o.departure_time === "string" ? o.departure_time : "", counts };
  });
}

export default async function CountsPage() {
  const auth = await requireAuth("driving");
  const shift = await getActiveShift(auth);

  const [colsRes, sheetRes] = await Promise.all([
    auth.supabase
      .from("locations")
      .select("id, code, name, count_group, count_label")
      .eq("organization_id", auth.org.id)
      .eq("active", true)
      .eq("is_count_column", true)
      .order("sort")
      .order("name"),
    shift
      ? auth.supabase
          .from("count_sheets")
          .select("id, shift_id, rows, status, submitted_at, created_at, work_date, updated_at")
          .eq("organization_id", auth.org.id)
          .eq("shift_id", shift.id)
          .maybeSingle()
      : auth.supabase
          .from("count_sheets")
          .select("id, shift_id, rows, status, submitted_at, created_at, work_date, updated_at")
          .eq("organization_id", auth.org.id)
          .eq("employee_id", auth.employee.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
  ]);

  if (colsRes.error || sheetRes.error) {
    return (
      <>
        <FieldHeader title="Passenger counting sheet" />
        <Notice tone="danger" icon={AlertTriangle} role="alert" title="The sheet could not be loaded">
          Check your connection and refresh the page.
        </Notice>
      </>
    );
  }

  const sheet = sheetRes.data;
  // Without an active shift only a submitted sheet from the last shift is shown, read-only.
  if (!shift && sheet?.status !== "submitted") {
    return (
      <>
        <FieldHeader title="Passenger counting sheet" />
        <Card>
          <EmptyState
            icon={Clock}
            title="You are not clocked in"
            description="Clock in at the kiosk to start a counting sheet for your shift."
          />
        </Card>
      </>
    );
  }

  const columns = (colsRes.data ?? []).map(toSheetColumn);
  if (!columns.length) {
    return (
      <>
        <FieldHeader title="Passenger counting sheet" />
        <Card>
          <EmptyState
            icon={Table2}
            title="No count columns set up"
            description="Your organization has not chosen which locations to count. Ask an admin to turn on count columns in Settings."
          />
        </Card>
      </>
    );
  }

  // Header box: the shift the sheet belongs to (the active one, else the one it was written on).
  const shiftId = shift?.id ?? sheet?.shift_id ?? null;
  const [shiftRes, breaksRes] = shiftId
    ? await Promise.all([
        auth.supabase
          .from("shifts")
          .select("scheduled_start, scheduled_end, clock_in_at, clock_out_at, work_date, vehicle:vehicles(number)")
          .eq("organization_id", auth.org.id)
          .eq("id", shiftId)
          .maybeSingle(),
        auth.supabase
          .from("breaks")
          .select("kind, sequence, planned_minutes, window_start")
          .eq("organization_id", auth.org.id)
          .eq("shift_id", shiftId)
          .eq("kind", "rest")
          .order("sequence"),
      ])
    : [null, null];
  const sh = shiftRes?.data ?? null;
  const tz = auth.org.timezone;
  const c24 = auth.settings.clock24h;
  const plannedEnd = sh
    ? (sh.scheduled_end ?? new Date(new Date(sh.clock_in_at).getTime() + auth.settings.breaks.defaultShiftMinutes * 60_000).toISOString())
    : null;
  const header = {
    operator: lastFirst(auth.employee),
    start: fmtPaperTime(sh ? (sh.scheduled_start ?? sh.clock_in_at) : null, tz, c24),
    end: fmtPaperTime(plannedEnd, tz, c24),
    date: fmtLocalDate(shift?.work_date ?? sheet?.work_date ?? null, "MM/dd/yy"),
    bus: shift?.vehicle?.number ?? sh?.vehicle?.number ?? "",
    breakWindows: formatBreakWindows(breaksRes?.data ?? [], tz),
    checkIn: stampLabel(sh?.clock_in_at, tz, c24),
    checkOut: stampLabel(sh?.clock_out_at, tz, c24),
  };

  const subtitle = shift
    ? `${shift.vehicle ? `Vehicle ${shift.vehicle.number} · ` : ""}${fmtLocalDate(shift.work_date)}`
    : sheet
      ? `Last shift · ${fmtLocalDate(sheet.work_date)}`
      : "";

  return (
    <>
      <FieldHeader title="Passenger counting sheet" description={subtitle} />
      <CountSheet
        columns={columns}
        initialRows={parseRows(sheet?.rows)}
        submitted={sheet?.status === "submitted"}
        submittedAt={sheet?.submitted_at ? fmtDateTime(sheet.submitted_at, tz, c24) : null}
        header={header}
        slogan={auth.settings.counts.slogan}
      />
    </>
  );
}
