import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { fullName, todayIn } from "@/lib/format";
import { toShiftRecords } from "@/lib/labor/records";
import { addDaysYmd } from "@/lib/scheduling/datetime";
import { computePerformance, type PerfShift } from "@/lib/scheduling/performance";
import { PerformanceTable, type PerfRow } from "./_components/performance-table";

export const metadata = { title: "Performance" };

const PERIODS = [30, 60, 90] as const;

const SHIFT_SELECT =
  "id, employee_id, clock_in_at, clock_out_at, work_date, vehicle_id, breaks(kind, paid, started_at, ended_at, status)";

export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const auth = await requireAuth("performance");
  const { days: daysParam } = await searchParams;
  const days = PERIODS.find((d) => String(d) === daysParam) ?? 30;
  const db = auth.supabase;
  const org = auth.org.id;
  const since = addDaysYmd(todayIn(auth.org.timezone), -days);

  const [empsRes, shiftsRes, inspRes, countsRes, meetingsRes] = await Promise.all([
    db
      .from("employees")
      .select("id, first_name, last_name, role")
      .eq("organization_id", org)
      .in("role", ["driver", "fueler", "technician"])
      .neq("status", "terminated")
      .order("last_name"),
    db
      .from("shifts")
      .select(SHIFT_SELECT)
      .eq("organization_id", org)
      .neq("status", "void")
      .gte("work_date", since)
      .limit(20000),
    db
      .from("inspections")
      .select("shift_id, kind")
      .eq("organization_id", org)
      .not("submitted_at", "is", null)
      .gte("created_at", `${addDaysYmd(since, -1)}T00:00:00Z`)
      .limit(20000),
    db
      .from("count_sheets")
      .select("shift_id")
      .eq("organization_id", org)
      .eq("status", "submitted")
      .gte("work_date", since)
      .limit(20000),
    db
      .from("safety_meetings")
      .select("id")
      .eq("organization_id", org)
      .eq("status", "completed")
      .gte("starts_at", `${since}T00:00:00Z`)
      .limit(2000),
  ]);

  const meetingIds = (meetingsRes.data ?? []).map((m) => m.id);
  const attendance = meetingIds.length
    ? ((
        await db
          .from("safety_attendance")
          .select("employee_id, status")
          .eq("organization_id", org)
          .in("meeting_id", meetingIds)
          .limit(50000)
      ).data ?? [])
    : [];

  const shiftsByEmp = new Map<string, PerfShift[]>();
  const rawShifts = shiftsRes.data ?? [];
  const records = toShiftRecords(rawShifts);
  rawShifts.forEach((s, i) => {
    const breaks = s.breaks ?? [];
    const item: PerfShift = {
      record: records[i],
      hasVehicle: Boolean(s.vehicle_id),
      missedBreaks: breaks.filter((b) => b.status === "missed").length,
      overrunBreaks: breaks.filter((b) => b.status === "overrun").length,
    };
    shiftsByEmp.set(s.employee_id, [...(shiftsByEmp.get(s.employee_id) ?? []), item]);
  });
  const inspections = inspRes.data ?? [];
  const countIds = (countsRes.data ?? []).map((c) => c.shift_id);

  const rows: PerfRow[] = (empsRes.data ?? []).map((e) => {
    const shifts = shiftsByEmp.get(e.id) ?? [];
    const ids = new Set(shifts.map((s) => s.record.id));
    const p = computePerformance({
      shifts,
      inspections: inspections.filter((i) => ids.has(i.shift_id)).map((i) => ({ shiftId: i.shift_id, kind: i.kind })),
      countSheetShiftIds: countIds.filter((id) => ids.has(id)),
      attendance: attendance.filter((a) => a.employee_id === e.id),
      countsExpected: e.role === "driver",
    });
    return {
      id: e.id,
      name: fullName(e),
      roleLabel: ROLE_LABEL[e.role],
      shifts: p.shifts,
      hours: p.minutes / 60,
      missedBreaks: p.missedBreaks,
      overruns: p.overruns,
      inspectionPct: p.inspectionPct,
      countSheetPct: p.countSheetPct,
      safetyPct: p.safetyPct,
    };
  });

  return (
    <>
      <PageHeader
        title="Performance"
        description={`Drivers, fuelers and technicians over the last ${days} days. Percentages are green at 80 and up, amber at 60 and up.`}
        actions={
          <div className="flex gap-1" role="group" aria-label="Period">
            {PERIODS.map((d) => (
              <Button key={d} asChild size="sm" variant={d === days ? "primary" : "secondary"}>
                <Link href={`/performance?days=${d}`} aria-current={d === days ? "true" : undefined}>
                  {d}d
                </Link>
              </Button>
            ))}
          </div>
        }
      />
      <Card>
        <PerformanceTable rows={rows} />
      </Card>
    </>
  );
}
