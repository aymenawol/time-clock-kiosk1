import { AlertTriangle, Clock } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { LiveRefresh } from "@/components/realtime/use-live-refresh";
import { requireAuth } from "@/lib/auth/session";
import { fmtLocalDate, fmtMinutes, fullName } from "@/lib/format";
import { emptyTotals } from "@/lib/labor/types";
import { addDaysYmd, loadTimesheets, resolveRange } from "./_lib";

export const metadata = { title: "Timesheets" };

export default async function TimesheetsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requireAuth("timesheets");
  const sp = await searchParams;
  const { from, to, weekStart } = resolveRange(auth, sp.from, sp.to);
  const { summaries } = await loadTimesheets(auth, from, to);

  const { data: employees } = await auth.supabase
    .from("employees")
    .select("id, first_name, last_name, employee_number")
    .eq("organization_id", auth.org.id)
    .limit(5000);
  const people = new Map((employees ?? []).map((e) => [e.id, e]));

  const rows = [...summaries.values()].sort((a, b) =>
    fullName(people.get(a.employeeId)).localeCompare(fullName(people.get(b.employeeId))),
  );
  const sum = emptyTotals();
  let shifts = 0;
  let missed = 0;
  let open = 0;
  for (const r of rows) {
    shifts += r.shifts;
    missed += r.missedBreaks;
    open += r.openShifts;
    for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] += r.totals[k];
  }
  const qs = (f: string, t: string) => `?from=${f}&to=${t}`;
  const length = Math.round((new Date(`${to}T00:00`).getTime() - new Date(`${from}T00:00`).getTime()) / 86400000) + 1;

  return (
    <>
      <LiveRefresh organizationId={auth.org.id} tables={["shifts", "breaks"]} />
      <PageHeader
        title="Timesheets"
        description={`${fmtLocalDate(from, "MMM d")} to ${fmtLocalDate(to, "MMM d, yyyy")}. Overtime follows Nevada rules (NRS 608.018).`}
      />

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              From
              <Input type="date" name="from" defaultValue={from} className="w-40" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              To
              <Input type="date" name="to" defaultValue={to} className="w-40" />
            </label>
            <Button type="submit" variant="secondary">
              Show
            </Button>
          </form>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href={qs(addDaysYmd(from, -length), addDaysYmd(from, -1))}>Previous</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href={qs(weekStart, addDaysYmd(weekStart, 6))}>This week</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href={qs(addDaysYmd(to, 1), addDaysYmd(to, length))}>Next</Link>
            </Button>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={Clock} title="No time records in this range" description="Shifts appear here once people clock in at the kiosk." />
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Employee</TH>
                <TH className="text-right">Shifts</TH>
                <TH className="text-right">Worked</TH>
                <TH className="text-right">Regular</TH>
                <TH className="text-right">Daily OT</TH>
                <TH className="text-right">Weekly OT</TH>
                <TH className="text-right">Missed breaks</TH>
                <TH>Flags</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => {
                const e = people.get(r.employeeId);
                return (
                  <TR key={r.employeeId}>
                    <TD>
                      <Link href={`/timesheets/${r.employeeId}${qs(from, to)}`} className="flex items-center gap-3 font-medium hover:text-primary">
                        <Avatar name={fullName(e)} />
                        <span>
                          {fullName(e)}
                          <span className="block text-xs font-normal text-muted">#{e?.employee_number}</span>
                        </span>
                      </Link>
                    </TD>
                    <TD className="tabular text-right">{r.shifts}</TD>
                    <TD className="tabular text-right">{fmtMinutes(r.totals.worked)}</TD>
                    <TD className="tabular text-right">{fmtMinutes(r.totals.regular)}</TD>
                    <TD className={`tabular text-right ${r.totals.dailyOvertime > 0 ? "font-medium text-warning" : "text-muted"}`}>
                      {r.dailyOvertimeApplies ? fmtMinutes(r.totals.dailyOvertime) : "n/a"}
                    </TD>
                    <TD className={`tabular text-right ${r.totals.weeklyOvertime > 0 ? "font-medium text-warning" : "text-muted"}`}>
                      {fmtMinutes(r.totals.weeklyOvertime)}
                    </TD>
                    <TD className={`tabular text-right ${r.missedBreaks > 0 ? "font-medium text-danger" : "text-muted"}`}>{r.missedBreaks}</TD>
                    <TD>
                      {r.openShifts > 0 ? (
                        <Badge tone="primary" dot>
                          <AlertTriangle className="size-3" aria-hidden /> Open shift
                        </Badge>
                      ) : null}
                    </TD>
                  </TR>
                );
              })}
              <TR className="bg-surface-2 font-semibold hover:bg-surface-2">
                <TD>Total</TD>
                <TD className="tabular text-right">{shifts}</TD>
                <TD className="tabular text-right">{fmtMinutes(sum.worked)}</TD>
                <TD className="tabular text-right">{fmtMinutes(sum.regular)}</TD>
                <TD className="tabular text-right">{fmtMinutes(sum.dailyOvertime)}</TD>
                <TD className="tabular text-right">{fmtMinutes(sum.weeklyOvertime)}</TD>
                <TD className="tabular text-right">{missed}</TD>
                <TD>{open ? `${open} open` : ""}</TD>
              </TR>
            </TBody>
          </Table>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">
        Daily overtime shows n/a for employees paid at least 1.5 times the minimum wage or exempted on their profile. Times are in{" "}
        {auth.org.timezone}.
      </p>
    </>
  );
}
