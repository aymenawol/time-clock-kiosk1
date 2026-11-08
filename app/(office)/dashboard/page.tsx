import {
  Accessibility,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Coffee,
  DollarSign,
  FileText,
  HeartPulse,
  ShieldCheck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { VEHICLE_STATUS_ORDER, VehicleStatusPill } from "@/components/domain/status";
import { BREAK_KIND_LABEL } from "@/components/ops/break-state";
import { dayRange, serverNow } from "@/components/ops/time";
import { Age, Elapsed } from "@/components/ops/timers";
import { LiveRefresh } from "@/components/realtime/use-live-refresh";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { can, ROLE_LABEL } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { fmtDateTime, fmtLocalDate, fmtTime, fullName, todayIn } from "@/lib/format";
import type { VehicleStatus } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const auth = await requireAuth("dashboard");
  const db = auth.supabase;
  const org = auth.org.id;
  const tz = auth.org.timezone;
  const clock24h = auth.settings.clock24h;
  const now = serverNow();
  const today = todayIn(tz);
  const dayStartIso = dayRange(today, tz).start.toISOString();
  const nowIso = new Date(now).toISOString();
  const isPayroll = can(auth.employee.role, "payroll");

  const count = (r: { count: number | null }) => r.count ?? 0;

  const [shifts, vehicles, missed, fatigue, assists, escalated, defects, forms, period, meeting] = await Promise.all([
    db
      .from("shifts")
      .select(
        "id, clock_in_at, vehicle:vehicles(number), employee:employees!shifts_employee_id_fkey(first_name, last_name, role), breaks(kind, started_at, ended_at, planned_minutes)",
      )
      .eq("organization_id", org)
      .eq("status", "active")
      .order("clock_in_at"),
    db.from("vehicles").select("status").eq("organization_id", org).eq("active", true),
    db
      .from("breaks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org)
      .eq("status", "missed")
      .gte("missed_alerted_at", dayStartIso),
    db.from("fatigue_alerts").select("id", { count: "exact", head: true }).eq("organization_id", org).eq("status", "open"),
    db
      .from("assist_requests")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org)
      .in("status", ["pending", "escalated"]),
    db
      .from("assist_requests")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org)
      .eq("status", "escalated"),
    db
      .from("defects")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org)
      .eq("severity", "critical")
      .in("status", ["open", "in_progress"]),
    db.from("form_submissions").select("id", { count: "exact", head: true }).eq("organization_id", org).eq("status", "submitted"),
    isPayroll
      ? db
          .from("pay_periods")
          .select("id, starts_on, ends_on, pay_date, status")
          .eq("organization_id", org)
          .lte("starts_on", today)
          .gte("ends_on", today)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from("safety_meetings")
      .select("id, title, starts_at, location, duration_minutes")
      .eq("organization_id", org)
      .eq("status", "scheduled")
      .gte("starts_at", nowIso)
      .order("starts_at")
      .limit(1)
      .maybeSingle(),
  ]);

  const onClock = shifts.data ?? [];
  const onBreak = onClock
    .map((s) => ({ shift: s, current: s.breaks.find((b) => b.started_at && !b.ended_at) }))
    .filter((x) => x.current);

  const statusCounts = new Map<VehicleStatus, number>();
  for (const v of vehicles.data ?? []) statusCounts.set(v.status, (statusCounts.get(v.status) ?? 0) + 1);
  const fleetTotal = vehicles.data?.length ?? 0;

  const alerts: { label: string; count: number; href: string; icon: LucideIcon; tone: "danger" | "warning"; hint?: string; show: boolean }[] = [
    { label: "Missed breaks today", count: count(missed), href: "/compliance", icon: Coffee, tone: "warning", show: true },
    { label: "Open fatigue alerts", count: count(fatigue), href: "/fatigue", icon: HeartPulse, tone: "warning", show: true },
    {
      label: "Assist requests waiting",
      count: count(assists),
      href: "/assists",
      icon: Accessibility,
      tone: count(escalated) ? "danger" : "warning",
      hint: count(escalated) ? `${count(escalated)} escalated` : undefined,
      show: true,
    },
    { label: "Open critical defects", count: count(defects), href: "/fleet/defects", icon: Wrench, tone: "danger", show: true },
    {
      label: "Forms awaiting review",
      count: count(forms),
      href: "/forms",
      icon: FileText,
      tone: "warning",
      show: can(auth.employee.role, "forms"),
    },
  ];
  const openAlertTotal = alerts.filter((a) => a.show && a.href !== "/forms").reduce((n, a) => n + a.count, 0);

  return (
    <>
      <LiveRefresh
        organizationId={org}
        tables={["shifts", "breaks", "vehicles", "assist_requests", "fatigue_alerts", "defects"]}
        debounceMs={2000}
      />
      <PageHeader title="Dashboard" description={`${auth.org.name} · ${fmtLocalDate(today, "EEEE, MMMM d")}`} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="On the clock" value={onClock.length} href="/board" />
        <Tile label="On break" value={onBreak.length} href="/compliance" />
        <Tile
          label="Vehicles ready"
          value={statusCounts.get("ready") ?? 0}
          hint={`of ${fleetTotal} in the fleet`}
          href="/fleet/readiness"
          tone="success"
        />
        <Tile label="Open alerts" value={openAlertTotal} href="/board" tone={openAlertTotal ? "danger" : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader
              title="On the clock now"
              description={`${onClock.length} ${onClock.length === 1 ? "person" : "people"}`}
              actions={<CardLink href="/board">Dispatch board</CardLink>}
            />
            {onClock.length === 0 ? (
              <EmptyState icon={Users} title="Nobody is on the clock" description="People appear here when they clock in at the kiosk." />
            ) : (
              <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
                {onClock.map((s) => {
                  const current = s.breaks.find((b) => b.started_at && !b.ended_at);
                  return (
                    <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{fullName(s.employee)}</p>
                        <p className="text-xs text-muted">
                          {ROLE_LABEL[s.employee.role]}
                          {s.vehicle ? ` · Vehicle ${s.vehicle.number}` : ""}
                        </p>
                      </div>
                      {current?.started_at ? (
                        <Badge tone="primary" dot>
                          {BREAK_KIND_LABEL[current.kind]} <Elapsed since={current.started_at} serverNow={now} />
                        </Badge>
                      ) : null}
                      <div className="shrink-0 text-right text-xs text-muted">
                        <p className="tabular">since {fmtTime(s.clock_in_at, tz, clock24h)}</p>
                        <Age at={s.clock_in_at} serverNow={now} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Open alerts" description="Things that need someone to act." />
            <ul className="divide-y divide-border">
              {alerts
                .filter((a) => a.show)
                .map((a) => (
                  <li key={a.label}>
                    <Link href={a.href} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
                      <a.icon className="size-4 shrink-0 text-muted" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{a.label}</span>
                        {a.hint ? <span className="block text-xs text-danger">{a.hint}</span> : null}
                      </span>
                      <span
                        className={cn(
                          "tabular text-lg font-semibold",
                          a.count === 0 ? "text-muted" : a.tone === "danger" ? "text-danger" : "text-warning",
                        )}
                      >
                        {a.count}
                      </span>
                      <ChevronRight className="size-4 text-muted" aria-hidden />
                    </Link>
                  </li>
                ))}
            </ul>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader title="Fleet readiness" description={`${fleetTotal} active vehicles`} actions={<CardLink href="/fleet/readiness">Readiness</CardLink>} />
            {fleetTotal === 0 ? (
              <p className="px-4 py-4 text-sm text-muted">No vehicles yet.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-x-4 px-4 py-2 sm:grid-cols-2">
                {VEHICLE_STATUS_ORDER.filter((s) => statusCounts.get(s)).map((s) => (
                  <li key={s} className="flex items-center justify-between gap-2 py-1.5">
                    <VehicleStatusPill status={s} />
                    <span className="tabular font-semibold">{statusCounts.get(s)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <DollarSign className="size-4 text-muted" aria-hidden />
                  Current pay period
                </span>
              }
              actions={isPayroll ? <CardLink href={period.data ? `/payroll/${period.data.id}` : "/payroll"}>Payroll</CardLink> : null}
            />
            <div className="px-4 py-3 text-sm">
              {!isPayroll ? (
                <p className="text-muted">Payroll is managed by admins.</p>
              ) : period.data ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {fmtLocalDate(period.data.starts_on, "MMM d")} – {fmtLocalDate(period.data.ends_on, "MMM d")}
                    </p>
                    {period.data.pay_date ? <p className="text-xs text-muted">Pay date {fmtLocalDate(period.data.pay_date)}</p> : null}
                  </div>
                  <Badge tone={period.data.status === "locked" ? "neutral" : "success"} dot>
                    {period.data.status === "locked" ? "Locked" : "Open"}
                  </Badge>
                </div>
              ) : (
                <p className="text-muted">
                  No pay period covers today.{" "}
                  <Link href="/payroll" className="text-primary hover:underline">
                    Create one
                  </Link>
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-muted" aria-hidden />
                  Next safety meeting
                </span>
              }
              actions={can(auth.employee.role, "safety") ? <CardLink href="/safety">Meetings</CardLink> : null}
            />
            <div className="px-4 py-3 text-sm">
              {meeting.data ? (
                <div className="flex items-start gap-3">
                  <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                  <div className="min-w-0">
                    <p className="font-medium">{meeting.data.title}</p>
                    <p className="text-xs text-muted">
                      {fmtDateTime(meeting.data.starts_at, tz, clock24h)} · {meeting.data.duration_minutes} min
                      {meeting.data.location ? ` · ${meeting.data.location}` : ""}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted">Nothing scheduled.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function Tile({
  label,
  value,
  hint,
  href,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  href: string;
  tone?: "success" | "danger";
}) {
  return (
    <Link
      href={href}
      className="group rounded-[var(--radius-card)] border border-border bg-surface p-4 transition-colors hover:border-border-strong"
    >
      <p className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted">
        {label}
        <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular",
          tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-fg",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </Link>
  );
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm text-primary hover:underline">
      {children}
    </Link>
  );
}
