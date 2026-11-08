import { AlertTriangle, Clock, Table2 } from "lucide-react";
import { getActiveShift } from "@/components/field/data";
import { FieldHeader, Notice } from "@/components/field/field-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime, fmtLocalDate } from "@/lib/format";
import { CountSheet, type CountColumn, type CountRow } from "./count-sheet";

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
      .select("id, code, name")
      .eq("organization_id", auth.org.id)
      .eq("active", true)
      .eq("is_count_column", true)
      .order("sort")
      .order("name"),
    shift
      ? auth.supabase
          .from("count_sheets")
          .select("id, rows, status, submitted_at, work_date, updated_at")
          .eq("organization_id", auth.org.id)
          .eq("shift_id", shift.id)
          .maybeSingle()
      : auth.supabase
          .from("count_sheets")
          .select("id, rows, status, submitted_at, work_date, updated_at")
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

  const columns: CountColumn[] = colsRes.data ?? [];
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
        submittedAt={sheet?.submitted_at ? fmtDateTime(sheet.submitted_at, auth.org.timezone, auth.settings.clock24h) : null}
        driverName={`${auth.employee.first_name} ${auth.employee.last_name}`}
        vehicleNumber={shift?.vehicle?.number ?? null}
        dateLabel={fmtLocalDate(shift?.work_date ?? sheet?.work_date ?? null)}
      />
    </>
  );
}
