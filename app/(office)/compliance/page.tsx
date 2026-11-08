import { AlertTriangle, ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import { BreakStatusPill } from "@/components/domain/status";
import { BREAK_KIND_LABEL, breakState } from "@/components/ops/break-state";
import { DateNav } from "@/components/ops/date-nav";
import { loadShiftsForDate, type OpsShift } from "@/components/ops/queries";
import { ReopenBreakButton } from "@/components/ops/reopen-button";
import { parseYmd, serverNow } from "@/components/ops/time";
import { LiveRefresh } from "@/components/realtime/use-live-refresh";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { fmtLocalDate, fmtMinutes, fmtTime, fmtDateTime, fullName, todayIn } from "@/lib/format";
import { VerdictDialog } from "./_components/verdict-dialog";

export const metadata: Metadata = { title: "Breaks and compliance" };

/** Suggested verdict from shift data: flag a missed or overrun break, or a shift that never closed. */
function suggestedVerdict(s: OpsShift): "ok" | "flag" {
  const bad = s.breaks.some((b) => b.status === "missed" || b.status === "overrun");
  return bad || (s.status !== "active" && !s.clock_out_at) ? "flag" : "ok";
}

export default async function CompliancePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const auth = await requireAuth("compliance");
  const sp = await searchParams;
  const tz = auth.org.timezone;
  const c24 = auth.settings.clock24h;
  const today = todayIn(tz);
  const date = parseYmd(sp.date, today);
  const role = auth.employee.role;
  const canVerdict = can(role, "complianceVerdict");
  const canReopen = can(role, "breakReopen");
  const now = serverNow();

  const shifts = await loadShiftsForDate(auth, date);
  const active = shifts.filter((s) => s.status === "active").length;
  const completed = shifts.filter((s) => s.status === "completed").length;
  const flagged = shifts.filter((s) => s.compliance_verdict === "flag").length;
  const pending = shifts.filter((s) => s.status === "completed" && !s.compliance_verdict).length;

  const alerts = shifts.flatMap((s) =>
    s.breaks.filter((b) => b.status === "missed" || b.status === "overrun").map((b) => ({ shift: s, brk: b })),
  );

  return (
    <>
      <LiveRefresh organizationId={auth.org.id} tables={["shifts", "breaks"]} />
      <PageHeader
        title="Breaks and compliance"
        description={`${fmtLocalDate(date, "EEEE, MMMM d, yyyy")}. Review meal and rest breaks and record a verdict for each shift.`}
        actions={<DateNav basePath="/compliance" date={date} today={today} />}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active" value={active} tone="primary" />
        <Stat label="Completed" value={completed} tone="success" />
        <Stat label="Awaiting verdict" value={pending} tone={pending ? "warning" : undefined} />
        <Stat label="Flagged" value={flagged} tone={flagged ? "danger" : undefined} />
      </div>

      {alerts.length ? (
        <Card className="mb-4 border-warning/40 bg-warning-soft/30">
          <CardHeader
            title={
              <span className="flex items-center gap-2 text-warning">
                <AlertTriangle className="size-4" aria-hidden />
                Break alerts ({alerts.length})
              </span>
            }
          />
          <ul className="divide-y divide-border">
            {alerts.map(({ shift, brk }) => (
              <li key={brk.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                <BreakStatusPill status={brk.status} />
                <span className="font-medium">{fullName(shift.employee)}</span>
                <span className="text-muted">
                  {BREAK_KIND_LABEL[brk.kind]} break {brk.sequence}
                  {shift.vehicle ? ` · Vehicle ${shift.vehicle.number}` : ""}
                </span>
                {brk.started_at ? (
                  <span className="tabular text-xs text-muted">Started {fmtTime(brk.started_at, tz, c24)}</span>
                ) : null}
                {canReopen && shift.status === "active" && brk.status === "missed" ? (
                  <ReopenBreakButton breakId={brk.id} className="ml-auto" />
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader title={`Shifts (${shifts.length})`} />
        {shifts.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title={`No shifts on ${fmtLocalDate(date)}`} description="Shifts appear here after people clock in at the kiosk." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Employee</TH>
                <TH>Vehicle</TH>
                <TH>Clock in</TH>
                <TH>Clock out</TH>
                <TH>Breaks (planned / taken)</TH>
                <TH>Verdict</TH>
              </tr>
            </THead>
            <TBody>
              {shifts.map((s) => {
                const name = fullName(s.employee);
                const state = breakState(s.breaks, now);
                const suggested = suggestedVerdict(s);
                return (
                  <TR key={s.id} className="align-top">
                    <TD>
                      <p className="whitespace-nowrap font-medium">{name}</p>
                      <p className="whitespace-nowrap text-xs text-muted">
                        #{s.employee.employee_number}
                        {s.status === "active" ? " · on the clock" : ""}
                      </p>
                    </TD>
                    <TD className="whitespace-nowrap">
                      {s.vehicle ? <span className="font-mono font-semibold">{s.vehicle.number}</span> : <span className="text-muted">-</span>}
                    </TD>
                    <TD className="tabular whitespace-nowrap">{fmtTime(s.clock_in_at, tz, c24)}</TD>
                    <TD className="tabular whitespace-nowrap">{s.clock_out_at ? fmtTime(s.clock_out_at, tz, c24) : <span className="text-muted">-</span>}</TD>
                    <TD>
                      {state.sorted.length === 0 ? (
                        <span className="text-muted">No breaks planned</span>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {state.sorted.map((b) => {
                            const takenMin =
                              b.started_at && b.ended_at
                                ? (new Date(b.ended_at).getTime() - new Date(b.started_at).getTime()) / 60000
                                : null;
                            return (
                              <li key={b.id} className="flex flex-wrap items-center gap-2 whitespace-nowrap">
                                <span className="w-24 text-xs text-muted">
                                  {BREAK_KIND_LABEL[b.kind]} {b.sequence}
                                </span>
                                <BreakStatusPill status={b.status} />
                                <span className="tabular text-xs text-muted">
                                  {fmtMinutes(b.planned_minutes)} / {takenMin === null ? "-" : fmtMinutes(takenMin)}
                                </span>
                                {canReopen && s.status === "active" && b.status === "missed" ? (
                                  <ReopenBreakButton breakId={b.id} />
                                ) : null}
                              </li>
                            );
                          })}
                          {s.meal_waived ? (
                            <li>
                              <Badge tone="warning">Meal waiver on file</Badge>
                            </li>
                          ) : null}
                        </ul>
                      )}
                    </TD>
                    <TD>
                      <div className="flex flex-wrap items-center gap-2">
                        {s.compliance_verdict ? (
                          <Badge tone={s.compliance_verdict === "ok" ? "success" : "danger"} dot>
                            {s.compliance_verdict === "ok" ? "OK" : "Flagged"}
                          </Badge>
                        ) : (
                          <Badge tone="neutral">
                            {s.status === "active" ? "In progress" : `Suggested: ${suggested === "ok" ? "OK" : "Flag"}`}
                          </Badge>
                        )}
                        {canVerdict ? (
                          <VerdictDialog
                            shiftId={s.id}
                            employeeName={name}
                            verdict={s.compliance_verdict === "ok" || s.compliance_verdict === "flag" ? s.compliance_verdict : null}
                            note={s.compliance_note}
                            suggested={suggested}
                          />
                        ) : null}
                      </div>
                      {s.compliance_note ? <p className="mt-1 max-w-64 text-xs text-muted">{s.compliance_note}</p> : null}
                      {s.compliance_at ? (
                        <p className="mt-0.5 text-xs text-muted">{fmtDateTime(s.compliance_at, tz, c24)}</p>
                      ) : null}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
