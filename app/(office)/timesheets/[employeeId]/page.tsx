import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddShiftButton, ShiftCard, type ShiftView } from "@/components/people/shift-editor";
import { isoToInput } from "@/components/people/tz";
import { EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { LiveRefresh } from "@/components/realtime/use-live-refresh";
import { zId } from "@/lib/actions";
import { requireAuth } from "@/lib/auth/session";
import { fmtDate, fmtDateTime, fmtLocalDate, fmtMinutes, fmtTime, fullName } from "@/lib/format";
import { emptyTotals } from "@/lib/labor/types";
import { loadTimesheets, resolveRange } from "../_lib";

export const metadata = { title: "Timesheet" };

export default async function EmployeeTimesheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const auth = await requireAuth("timesheets");
  const { employeeId } = await params;
  if (!zId.safeParse(employeeId).success) notFound();
  const sp = await searchParams;
  const { from, to } = resolveRange(auth, sp.from, sp.to);
  const tz = auth.org.timezone;
  const c24 = auth.settings.clock24h;

  const { data: employee } = await auth.supabase
    .from("employees")
    .select("id, first_name, last_name, employee_number")
    .eq("id", employeeId)
    .eq("organization_id", auth.org.id)
    .maybeSingle();
  if (!employee) notFound();

  const { shifts, summaries } = await loadTimesheets(auth, from, to, employeeId);
  const summary = summaries.get(employeeId);
  const totals = summary?.totals ?? emptyTotals();
  const name = fullName(employee);

  const views: ShiftView[] = [...shifts]
    .sort((a, b) => b.clock_in_at.localeCompare(a.clock_in_at))
    .map((s) => {
      const t = summary?.byShift[s.id] ?? emptyTotals();
      return {
        id: s.id,
        dateLabel: fmtDate(s.clock_in_at, tz, "EEE, MMM d"),
        status: s.status,
        clockInInput: isoToInput(s.clock_in_at, tz),
        clockOutInput: isoToInput(s.clock_out_at, tz),
        inLabel: fmtDateTime(s.clock_in_at, tz, c24),
        outLabel: s.clock_out_at
          ? fmtDate(s.clock_out_at, tz, "MMM d") === fmtDate(s.clock_in_at, tz, "MMM d")
            ? fmtTime(s.clock_out_at, tz, c24)
            : fmtDateTime(s.clock_out_at, tz, c24)
          : "still clocked in",
        sourceLabel: s.source_in === "admin" ? "Added by admin" : "",
        editReason: s.edit_reason,
        worked: fmtMinutes(t.worked),
        regular: fmtMinutes(t.regular),
        dailyOt: summary?.dailyOvertimeApplies === false ? "n/a" : fmtMinutes(t.dailyOvertime),
        weeklyOt: fmtMinutes(t.weeklyOvertime),
        breaks: [...s.breaks]
          .sort((a, b) => (a.started_at ?? "9").localeCompare(b.started_at ?? "9") || a.sequence - b.sequence)
          .map((b) => ({
            id: b.id,
            label: `${b.kind === "meal" ? "Meal" : "Rest"} break ${b.sequence}`,
            status: b.status,
            startedInput: isoToInput(b.started_at, tz),
            endedInput: isoToInput(b.ended_at, tz),
            startedLabel: b.started_at ? fmtTime(b.started_at, tz, c24) : "not taken",
            endedLabel: b.started_at ? (b.ended_at ? fmtTime(b.ended_at, tz, c24) : "ongoing") : "-",
          })),
      };
    });

  return (
    <>
      <LiveRefresh organizationId={auth.org.id} tables={["shifts", "breaks"]} />
      <Link href={`/timesheets?from=${from}&to=${to}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Timesheets
      </Link>
      <PageHeader
        title={name}
        description={`#${employee.employee_number} · ${fmtLocalDate(from, "MMM d")} to ${fmtLocalDate(to, "MMM d, yyyy")}`}
        actions={<AddShiftButton employeeId={employeeId} timeZone={tz} name={name} />}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Worked" value={fmtMinutes(totals.worked)} />
        <Stat label="Regular" value={fmtMinutes(totals.regular)} />
        <Stat label="Daily OT" value={summary?.dailyOvertimeApplies === false ? "n/a" : fmtMinutes(totals.dailyOvertime)} tone={totals.dailyOvertime > 0 ? "warning" : undefined} />
        <Stat label="Weekly OT" value={fmtMinutes(totals.weeklyOvertime)} tone={totals.weeklyOvertime > 0 ? "warning" : undefined} />
        <Stat label="Missed breaks" value={summary?.missedBreaks ?? 0} tone={summary?.missedBreaks ? "danger" : undefined} />
      </div>

      {views.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface">
          <EmptyState title="No shifts in this range" description="Use Add missed shift if they worked but forgot to clock in." />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {views.map((v) => (
            <ShiftCard key={v.id} shift={v} timeZone={tz} canEdit />
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-muted">
        Edits to shifts in a locked pay period are blocked. Every change needs a reason and is written to the audit log.
      </p>
    </>
  );
}
