import { ChevronRight, DollarSign } from "lucide-react";
import Link from "next/link";
import { PAY_PERIOD_STATUS, StatusPill } from "@/components/admin/status";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/session";
import { fmtLocalDate } from "@/lib/format";
import { localDate, startOfWorkweek, type WeekStart } from "@/lib/labor/time";
import { suggestNextPeriod } from "@/lib/scheduling/pay-periods";
import { NevadaNote } from "./_components/nevada-note";
import { PeriodForm } from "./_components/period-form";

export const metadata = { title: "Payroll" };

export default async function PayrollPage() {
  const auth = await requireAuth("payroll");
  const [periodsRes, exportsRes] = await Promise.all([
    auth.supabase
      .from("pay_periods")
      .select("id, starts_on, ends_on, pay_date, status, locked_at")
      .eq("organization_id", auth.org.id)
      .order("starts_on", { ascending: false })
      .limit(100),
    auth.supabase.from("payroll_exports").select("pay_period_id").eq("organization_id", auth.org.id).limit(5000),
  ]);
  const periods = periodsRes.data ?? [];
  const exportCount = new Map<string, number>();
  for (const e of exportsRes.data ?? []) exportCount.set(e.pay_period_id, (exportCount.get(e.pay_period_id) ?? 0) + 1);

  const weekStart = localDate(
    startOfWorkweek(Date.now(), auth.org.timezone, auth.settings.workweekStartsOn as WeekStart),
    auth.org.timezone,
  );
  const lastEnd = periods.reduce<string | null>((m, p) => (m === null || p.ends_on > m ? p.ends_on : m), null);
  const suggested = suggestNextPeriod(lastEnd, weekStart);

  return (
    <>
      <PageHeader
        title="Payroll periods"
        description="Compute hours and overtime from time records, lock a period, and export it."
        actions={<PeriodForm suggested={suggested} />}
      />
      <div className="flex flex-col gap-6">
        <Card>
          {periods.length === 0 ? (
            <EmptyState icon={DollarSign} title="No pay periods created yet" description="Create the first period to compute hours and overtime." />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Period</TH>
                  <TH>Pay date</TH>
                  <TH className="text-right">Exports</TH>
                  <TH>Status</TH>
                  <TH>
                    <span className="sr-only">Open</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {periods.map((p) => (
                  <TR key={p.id}>
                    <TD className="whitespace-nowrap">
                      <Link href={`/payroll/${p.id}`} className="font-medium text-primary hover:underline">
                        {fmtLocalDate(p.starts_on, "MMM d")} – {fmtLocalDate(p.ends_on, "MMM d, yyyy")}
                      </Link>
                    </TD>
                    <TD className="whitespace-nowrap text-muted">{p.pay_date ? fmtLocalDate(p.pay_date, "MMM d, yyyy") : "-"}</TD>
                    <TD className="text-right tabular text-muted">{exportCount.get(p.id) ?? 0}</TD>
                    <TD>
                      <StatusPill map={PAY_PERIOD_STATUS} status={p.status} />
                    </TD>
                    <TD className="text-right">
                      <Link href={`/payroll/${p.id}`} aria-label="Open pay period" className="inline-flex text-muted hover:text-fg">
                        <ChevronRight className="size-4" aria-hidden />
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
        <NevadaNote
          minimumWageCents={auth.settings.labor.minimumWageCents}
          weekStartsOn={auth.settings.workweekStartsOn}
          multiplier={auth.settings.labor.overtimeMultiplier}
        />
      </div>
    </>
  );
}
