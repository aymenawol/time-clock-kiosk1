import { AlertTriangle, ArrowLeft, Download, Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/action-buttons";
import { PAY_PERIOD_STATUS, StatusPill } from "@/components/admin/status";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime, fmtLocalDate, fmtMoney } from "@/lib/format";
import { minutesToHours } from "@/lib/labor/payroll";
import type { DayPayRow } from "@/lib/scheduling/payroll-days";
import { lockPeriod } from "../actions";
import { loadPeriodData } from "../_lib/load";
import { NevadaNote } from "../_components/nevada-note";
import { UnlockButton } from "../_components/unlock-button";

export const metadata = { title: "Pay period" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const h = (m: number) => minutesToHours(m).toFixed(2);
const dash = (m: number) => (m > 0 ? h(m) : "—");

interface Summary {
  employee_id: string;
  name: string;
  employee_number: string;
  regular_minutes: number;
  ot_minutes: number;
  leave_minutes: number;
  pay_rate_cents: number;
  gross_cents: number;
}

export default async function PayPeriodPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("payroll");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { data: period } = await auth.supabase
    .from("pay_periods")
    .select("*")
    .eq("id", id)
    .eq("organization_id", auth.org.id)
    .maybeSingle();
  if (!period) notFound();

  const locked = period.status === "locked";
  const data = await loadPeriodData(auth, period);

  // A locked period shows the stored lines; the daily rows below are recalculated from time records.
  let summaries: Summary[];
  if (locked) {
    const [linesRes, empsRes] = await Promise.all([
      auth.supabase.from("pay_period_lines").select("*").eq("pay_period_id", period.id).eq("organization_id", auth.org.id),
      auth.supabase.from("employees").select("id, employee_number, first_name, last_name").eq("organization_id", auth.org.id),
    ]);
    const emps = new Map((empsRes.data ?? []).map((e) => [e.id, e]));
    summaries = (linesRes.data ?? [])
      .map((l) => {
        const e = emps.get(l.employee_id);
        return {
          employee_id: l.employee_id,
          name: e ? `${e.first_name} ${e.last_name}` : "Former employee",
          employee_number: e?.employee_number ?? "",
          regular_minutes: l.regular_minutes,
          ot_minutes: l.daily_ot_minutes + l.weekly_ot_minutes,
          leave_minutes: l.leave_minutes,
          pay_rate_cents: l.pay_rate_cents,
          gross_cents: Number(l.gross_cents),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } else {
    summaries = data.lines.map((l) => ({
      employee_id: l.employee_id,
      name: l.name,
      employee_number: l.employee_number,
      regular_minutes: l.regular_minutes,
      ot_minutes: l.daily_ot_minutes + l.weekly_ot_minutes,
      leave_minutes: l.leave_minutes,
      pay_rate_cents: l.pay_rate_cents,
      gross_cents: l.gross_cents,
    }));
  }

  const daysByEmployee = new Map<string, DayPayRow[]>();
  for (const d of data.days) daysByEmployee.set(d.employee_id, [...(daysByEmployee.get(d.employee_id) ?? []), d]);
  // Employees that only have an open shift have no summary yet.
  for (const [empId, days] of daysByEmployee) {
    if (!summaries.some((s) => s.employee_id === empId)) {
      summaries.push({
        employee_id: empId,
        name: days[0].name,
        employee_number: days[0].employee_number,
        regular_minutes: 0,
        ot_minutes: 0,
        leave_minutes: 0,
        pay_rate_cents: days[0].pay_rate_cents,
        gross_cents: 0,
      });
    }
  }
  summaries.sort((a, b) => a.name.localeCompare(b.name));

  const totalReg = summaries.reduce((s, r) => s + r.regular_minutes, 0);
  const totalOt = summaries.reduce((s, r) => s + r.ot_minutes, 0);
  const totalGross = summaries.reduce((s, r) => s + r.gross_cents, 0);
  const blocking = data.openShifts.length > 0;

  return (
    <>
      <Link href="/payroll" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Payroll
      </Link>
      <PageHeader
        title={`${fmtLocalDate(period.starts_on, "MMM d")} – ${fmtLocalDate(period.ends_on, "MMM d, yyyy")}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusPill map={PAY_PERIOD_STATUS} status={period.status} />
            {period.pay_date ? <span>Pay date {fmtLocalDate(period.pay_date, "MMM d, yyyy")}</span> : null}
            {period.locked_at ? <span>Locked {fmtDateTime(period.locked_at, auth.org.timezone, auth.settings.clock24h)}</span> : null}
          </span>
        }
        actions={
          <>
            <Button asChild size="sm" variant="secondary" disabled={summaries.length === 0}>
              <a href={`/payroll/${period.id}/export`} download>
                <Download aria-hidden /> Export CSV
              </a>
            </Button>
            {locked ? (
              <UnlockButton id={period.id} />
            ) : (
              <ActionButton
                size="sm"
                variant="danger"
                action={lockPeriod}
                input={{ id: period.id }}
                success="Pay period locked"
                disabled={blocking}
                confirm={{
                  title: "Lock this pay period?",
                  description: "Hours and pay are stored as they are now. Employees can see their own lines. You can unlock it later if needed.",
                  confirmLabel: "Lock period",
                  danger: true,
                }}
              >
                <Lock aria-hidden /> Lock period
              </ActionButton>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-6">
        {blocking ? (
          <div role="alert" className="flex gap-3 rounded-[var(--radius-card)] border border-danger/40 bg-danger-soft p-4 text-sm text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">
                {data.openShifts.length} shift{data.openShifts.length === 1 ? "" : "s"} still open. Locking is blocked until they are clocked out.
              </p>
              <ul className="mt-1 list-inside list-disc">
                {data.openShifts.map((s) => (
                  <li key={s.id}>
                    {s.name}, {fmtLocalDate(s.workDate)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
        {data.zeroRate.length > 0 ? (
          <div role="status" className="flex gap-3 rounded-[var(--radius-card)] border border-warning/40 bg-warning-soft p-4 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              Pay rate is $0.00 for {data.zeroRate.map((z) => z.name).join(", ")}. Set it on the employee page or their pay will be zero.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Employees" value={summaries.length} />
          <Stat label="Regular hours" value={h(totalReg)} tone="primary" />
          <Stat label="Overtime hours" value={h(totalOt)} tone="warning" />
          <Stat label="Gross pay" value={fmtMoney(totalGross)} tone="success" />
        </div>

        {summaries.length === 0 ? (
          <Card>
            <EmptyState title="No completed shifts in this period" description="Hours appear here once employees clock in and out on days inside the period." />
          </Card>
        ) : (
          summaries.map((s) => {
            const days = daysByEmployee.get(s.employee_id) ?? [];
            return (
              <Card key={s.employee_id}>
                <CardHeader
                  title={
                    <span>
                      {s.name} <span className="text-sm font-normal text-muted">#{s.employee_number}</span>
                    </span>
                  }
                  actions={
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular text-muted">
                      <span>
                        Reg <span className="font-medium text-primary">{h(s.regular_minutes)}</span>
                      </span>
                      <span>
                        OT <span className="font-medium text-warning">{h(s.ot_minutes)}</span>
                      </span>
                      {s.leave_minutes > 0 ? (
                        <span>
                          PTO <span className="font-medium text-fg">{h(s.leave_minutes)}</span>
                        </span>
                      ) : null}
                      <span>
                        Total <span className="font-semibold text-fg">{h(s.regular_minutes + s.ot_minutes + s.leave_minutes)}</span>
                      </span>
                      <span>
                        Rate <span className="font-medium text-fg">{fmtMoney(s.pay_rate_cents)}</span>
                      </span>
                      <span>
                        Gross <span className="font-semibold text-success">{fmtMoney(s.gross_cents)}</span>
                      </span>
                    </div>
                  }
                />
                <Table>
                  <THead>
                    <tr>
                      <TH>Date</TH>
                      <TH className="text-right">Regular</TH>
                      <TH className="text-right">OT</TH>
                      <TH className="text-right">PTO</TH>
                      <TH className="text-right">Total</TH>
                      <TH className="text-right">Missed breaks</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {days.map((d) => (
                      <TR key={d.work_date}>
                        <TD className="whitespace-nowrap">
                          {fmtLocalDate(d.work_date)}
                          {d.incomplete ? (
                            <span className="ml-2 inline-flex items-center gap-1 text-xs text-danger">
                              <AlertTriangle className="size-3" aria-hidden /> missing clock-out
                            </span>
                          ) : null}
                        </TD>
                        <TD className="text-right tabular text-primary">{h(d.regular_minutes)}</TD>
                        <TD className="text-right tabular text-warning">{dash(d.daily_ot_minutes + d.weekly_ot_minutes)}</TD>
                        <TD className="text-right tabular">{dash(d.leave_minutes)}</TD>
                        <TD className="text-right tabular font-semibold">{h(d.total_minutes)}</TD>
                        <TD className="text-right tabular">
                          {d.missed_breaks > 0 ? <span className="text-danger">{d.missed_breaks}</span> : "—"}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </Card>
            );
          })
        )}
        {locked ? (
          <p className="text-xs text-muted">
            Totals above are the stored lines from when the period was locked. Daily rows are recalculated from current time records.
          </p>
        ) : null}
        <NevadaNote
          minimumWageCents={auth.settings.labor.minimumWageCents}
          weekStartsOn={auth.settings.workweekStartsOn}
          multiplier={auth.settings.labor.overtimeMultiplier}
        />
      </div>
    </>
  );
}
