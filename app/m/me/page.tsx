import { Bell, ChevronRight, ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getLeaveBalances } from "@/components/requests/data";
import { getPerformance } from "@/components/requests/performance";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, SectionTitle, Stat } from "@/components/ui/misc";
import { SignOutButton, ThemeRow } from "@/components/requests/me-actions";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { fmtDate, fmtLocalDate, fmtMoney } from "@/lib/format";
import { LEAVE_KINDS, LEAVE_LABEL } from "@/lib/forms";

export const metadata: Metadata = { title: "Me" };
export const dynamic = "force-dynamic";

const pctText = (v: number | null) => (v === null ? "n/a" : `${v}%`);

export default async function MePage() {
  const auth = await requireAuth("field");
  const { supabase, org, employee } = auth;
  const tz = org.timezone;

  const [balances, ledgerRes, perf, seniorsRes, payRes, unreadRes] = await Promise.all([
    getLeaveBalances(supabase, org.id, employee.id),
    supabase
      .from("leave_ledger")
      .select("id, kind, hours, reason, created_at")
      .eq("organization_id", org.id)
      .eq("employee_id", employee.id)
      .order("created_at", { ascending: false })
      .limit(8),
    getPerformance(supabase, org.id, employee.id, employee.role),
    supabase
      .from("employees")
      .select("id, seniority_number")
      .eq("organization_id", org.id)
      .eq("status", "active")
      .not("seniority_number", "is", null),
    supabase
      .from("pay_period_lines")
      .select("*, period:pay_periods(starts_on, ends_on, pay_date, status)")
      .eq("organization_id", org.id)
      .eq("employee_id", employee.id)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id)
      .eq("employee_id", employee.id)
      .is("read_at", null),
  ]);

  const seniors = seniorsRes.data ?? [];
  const rank =
    employee.seniority_number === null
      ? null
      : seniors.filter((s) => (s.seniority_number ?? Infinity) < (employee.seniority_number ?? 0)).length + 1;

  const pay = payRes.data?.[0];
  const period = pay?.period ?? null;
  const payVisible = pay && (!period || period.status === "locked");
  const name = `${employee.first_name} ${employee.last_name}`;
  const unread = unreadRes.count ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Avatar name={name} className="size-14 text-lg" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{name}</h1>
          <p className="text-sm text-muted">
            {ROLE_LABEL[employee.role]} · #{employee.employee_number}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Hire date" value={employee.hire_date ? fmtLocalDate(employee.hire_date, "MMM d, yyyy") : "-"} className="[&_p:nth-child(2)]:text-lg" />
        <Stat
          label="Seniority"
          value={rank === null ? "Not set" : `#${rank}`}
          hint={rank === null ? undefined : `of ${seniors.length} active employees`}
        />
      </div>

      <section aria-label="Shortcuts" className="flex flex-col gap-3">
        <Link href="/m/requests" className="flex min-h-14 items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4 hover:bg-surface-2">
          <ClipboardList className="size-5 text-primary" aria-hidden />
          <span className="flex-1 font-medium">My requests</span>
          <ChevronRight className="size-5 text-muted" aria-hidden />
        </Link>
        <Link href="/m/notifications" className="flex min-h-14 items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4 hover:bg-surface-2">
          <Bell className="size-5 text-primary" aria-hidden />
          <span className="flex-1 font-medium">Notifications</span>
          {unread > 0 ? <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-fg">{unread}</span> : null}
          <ChevronRight className="size-5 text-muted" aria-hidden />
        </Link>
      </section>

      <Card>
        <CardHeader title="Leave balances" description="Hours available" />
        <CardBody className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3">
            {LEAVE_KINDS.map((k) => (
              <div key={k} className="rounded-[var(--radius-control)] bg-surface-2 p-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">{LEAVE_LABEL[k]}</dt>
                <dd className="mt-0.5 text-xl font-semibold tabular">{(balances[k] ?? 0).toFixed(2)} h</dd>
              </div>
            ))}
          </dl>
          <div>
            <SectionTitle>Recent activity</SectionTitle>
            {ledgerRes.error ? (
              <p role="alert" className="text-sm text-danger">
                Could not load your leave history.
              </p>
            ) : (ledgerRes.data ?? []).length === 0 ? (
              <p className="text-sm text-muted">No leave entries yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {(ledgerRes.data ?? []).map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate">{l.reason}</span>
                      <span className="block text-xs text-muted">
                        {LEAVE_LABEL[l.kind as keyof typeof LEAVE_LABEL] ?? l.kind} · {fmtDate(l.created_at, tz)}
                      </span>
                    </span>
                    <span className={Number(l.hours) < 0 ? "tabular font-medium text-danger" : "tabular font-medium text-success"}>
                      {Number(l.hours) > 0 ? "+" : ""}
                      {Number(l.hours).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardBody>
      </Card>

      {payVisible && pay ? (
        <Card>
          <CardHeader
            title="Last pay period"
            description={period ? `${fmtLocalDate(period.starts_on, "MMM d")} to ${fmtLocalDate(period.ends_on, "MMM d")}` : undefined}
          />
          <CardBody>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Item label="Regular hours" value={(pay.regular_minutes / 60).toFixed(2)} />
              <Item label="Overtime hours" value={((pay.daily_ot_minutes + pay.weekly_ot_minutes) / 60).toFixed(2)} />
              <Item label="Leave hours" value={(pay.leave_minutes / 60).toFixed(2)} />
              <Item label="Gross pay" value={fmtMoney(Number(pay.gross_cents))} />
            </dl>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Last 90 days" description="Your work record" />
        <CardBody>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Item label="Shifts worked" value={String(perf.shifts)} />
            <Item label="Hours worked" value={perf.hours.toFixed(1)} />
            <Item label="Breaks missed" value={String(perf.breaksMissed)} />
            <Item label="Breaks overrun" value={String(perf.breaksOverrun)} />
            <Item label="Inspections done" value={pctText(perf.inspectionPct)} />
            <Item label="Count sheets sent" value={pctText(perf.countSheetPct)} />
            <Item label="Safety meetings" value={pctText(perf.safetyPct)} />
          </dl>
          {perf.shifts === 0 ? <p className="mt-3 text-sm text-muted">No completed shifts in the last 90 days.</p> : null}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-4">
          <ThemeRow />
          <SignOutButton />
        </CardBody>
      </Card>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular">{value}</dd>
    </div>
  );
}
