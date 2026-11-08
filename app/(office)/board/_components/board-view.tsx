import { Accessibility, AlertOctagon, Coffee, HeartPulse, Map as MapIcon, Maximize2, Minimize2, Users } from "lucide-react";
import Link from "next/link";
import { BREAK_STATUS, VehicleStatusPill } from "@/components/domain/status";
import { AssignDialog } from "@/components/ops/assign-dialog";
import { BREAK_KIND_LABEL, type breakState } from "@/components/ops/break-state";
import { fmtDistance, fmtEta, STALE_AFTER_MS } from "@/components/ops/geo";
import type { AssignOptions, OpsShift } from "@/components/ops/queries";
import { ReopenBreakButton } from "@/components/ops/reopen-button";
import { Age, Elapsed, LiveClock, SlaTimer } from "@/components/ops/timers";
import { Badge, type Tone } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { cn } from "@/lib/cn";
import { fmtTime, fullName } from "@/lib/format";
import type { BreakKind, BreakStatus } from "@/lib/supabase/types";
import { OvertimeBanner, type Banner } from "./overtime-banner";

export interface BoardRow {
  shift: OpsShift;
  breaks: ReturnType<typeof breakState<OpsShift["breaks"][number]>>;
  pos: { lat: number; lng: number; speed: number | null; at: string } | null;
  where: string | null;
  eta: { stop: string; distance: number; seconds: number | null } | null;
  fatigue: FatigueItem[];
  radio: { code: string; label: string | null; alert: boolean; at: string | null } | null;
}

interface Name {
  first_name: string;
  last_name: string;
}

export interface AssistItem {
  id: string;
  status: string;
  created_at: string;
  passenger_name: string;
  flight_number: string | null;
  assist_type: string;
  passenger_count: number;
  employee: Name | null;
  vehicle: { number: string } | null;
  airline: { name: string; iata_code: string | null } | null;
  location: { code: string } | null;
}

export interface BreakAlert {
  id: string;
  kind: BreakKind;
  status: BreakStatus;
  window_start: string | null;
  window_end: string | null;
  started_at: string | null;
  ended_at: string | null;
  planned_minutes: number;
  shift: { id: string; status: string; employee: Name & { employee_number: string } };
}

export interface FatigueItem {
  id: string;
  employee_id: string;
  kind: string;
  severity: string;
  message: string;
  created_at: string;
  employee: Name | null;
}

export interface BoardData {
  rows: BoardRow[];
  assists: AssistItem[];
  breakAlerts: BreakAlert[];
  fatigue: FatigueItem[];
  emergency: { id: string; title: string; kind: string; created_at: string } | null;
  banners: Banner[];
  options: AssignOptions;
}

export const FATIGUE_LABEL: Record<string, string> = {
  long_shift: "Long shift",
  on_duty_limit: "On-duty limit",
  short_rest: "Short rest",
  consecutive_days: "Consecutive days",
  weekly_hours: "Weekly hours",
  weekly_overtime: "Weekly OT",
};

interface Props {
  data: BoardData;
  wall: boolean;
  serverNow: number;
  timeZone: string;
  clock24h: boolean;
  escalationMinutes: number;
  organizationName: string;
  canAssign: boolean;
  canReopen: boolean;
  canBanner: boolean;
  canMap: boolean;
  canAssists: boolean;
  canFatigue: boolean;
}

export function BoardView(props: Props) {
  const { data, wall, serverNow } = props;
  const onBreak = data.rows.filter((r) => r.breaks.current).length;
  const withVehicle = data.rows.filter((r) => r.shift.vehicle_id).length;
  const alertCount = data.assists.length + data.breakAlerts.length + data.fatigue.length;

  const body = (
    <>
      {data.emergency ? (
        <Link
          href="/emergency"
          className={cn(
            "mb-4 flex items-center gap-3 rounded-[var(--radius-card)] bg-danger px-4 py-3 font-semibold text-white",
            wall && "py-4 text-xl",
          )}
        >
          <AlertOctagon className="size-5 shrink-0 animate-pulse" aria-hidden />
          <span className="min-w-0 flex-1 truncate">Emergency active: {data.emergency.title}</span>
          <span className="shrink-0 text-sm font-normal opacity-90">
            <Age at={data.emergency.created_at} serverNow={serverNow} suffix=" ago" />
          </span>
        </Link>
      ) : null}

      <OvertimeBanner banners={data.banners} canEdit={props.canBanner} wall={wall} />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="On the clock" value={data.rows.length} wall={wall} />
        <Kpi label="With a vehicle" value={withVehicle} wall={wall} />
        <Kpi label="On break" value={onBreak} wall={wall} />
        <Kpi label="Open alerts" value={alertCount} tone={alertCount ? "danger" : undefined} wall={wall} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="min-w-0">
          <CardHeader title="Active shifts" description={wall ? undefined : "Field and office staff on the clock right now."} />
          {data.rows.length === 0 ? (
            <EmptyState icon={Users} title="Nobody is on the clock" description="Shifts appear here as soon as people clock in at the kiosk." />
          ) : (
            <ShiftTable {...props} />
          )}
        </Card>
        <AlertRail {...props} />
      </div>
    </>
  );

  if (wall) {
    return (
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-bg px-4 py-4 text-fg sm:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">{props.organizationName}</h1>
          <span className="text-lg text-muted">Dispatch board</span>
          <LiveClock serverNow={serverNow} timeZone={props.timeZone} clock24h={props.clock24h} className="ml-auto text-3xl font-semibold" />
          <Link href="/board" className={buttonVariants({ variant: "ghost", size: "sm" })} aria-label="Exit wall mode">
            <Minimize2 />
            Exit
          </Link>
        </div>
        {body}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Dispatch board"
        description="Live view of shifts, vehicles, breaks and alerts."
        actions={
          <>
            {props.canMap ? (
              <Link href="/map" className={buttonVariants({ variant: "secondary" })}>
                <MapIcon />
                Live map
              </Link>
            ) : null}
            <Link href="/board?wall=1" className={buttonVariants({ variant: "secondary" })}>
              <Maximize2 />
              Wall mode
            </Link>
          </>
        }
      />
      {body}
    </>
  );
}

function Kpi({ label, value, tone, wall }: { label: string; value: number; tone?: "danger"; wall: boolean }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("tabular font-semibold", wall ? "text-4xl" : "text-2xl", tone === "danger" ? "text-danger" : "text-fg")}>{value}</p>
    </div>
  );
}

function ShiftTable({ data, wall, serverNow, timeZone, clock24h, canAssign, canReopen }: Props) {
  const cell = wall ? "py-3.5 text-base" : "";
  return (
    <Table className={wall ? "text-base" : undefined}>
      <THead>
        <tr>
          <TH>Employee</TH>
          <TH>Vehicle</TH>
          <TH>Route</TH>
          <TH>Radio</TH>
          <TH>Break</TH>
          <TH>Last GPS</TH>
          <TH>Next stop</TH>
          <TH>Fatigue</TH>
        </tr>
      </THead>
      <TBody>
        {data.rows.map((row) => {
          const { shift, breaks } = row;
          const name = fullName(shift.employee);
          return (
            <TR key={shift.id}>
              <TD className={cell}>
                <p className="whitespace-nowrap font-medium">{name}</p>
                <p className="whitespace-nowrap text-xs text-muted">
                  #{shift.employee.employee_number}
                  {shift.employee.role !== "driver" ? ` · ${ROLE_LABEL[shift.employee.role]}` : ""} · in{" "}
                  {fmtTime(shift.clock_in_at, timeZone, clock24h)}
                </p>
              </TD>
              <TD className={cell}>
                <div className="flex items-center gap-2">
                  {shift.vehicle ? (
                    <div className="min-w-0">
                      <p className="font-mono font-semibold">{shift.vehicle.number}</p>
                      <VehicleStatusPill status={shift.vehicle.status} />
                    </div>
                  ) : (
                    <span className="text-muted">Unassigned</span>
                  )}
                  {canAssign ? (
                    <AssignDialog
                      compact
                      timeZone={timeZone}
                      options={data.options}
                      shift={{
                        id: shift.id,
                        employeeName: name,
                        active: true,
                        vehicle_id: shift.vehicle_id,
                        tablet_id: shift.tablet_id,
                        route_id: shift.route_id,
                        scheduled_start: shift.scheduled_start,
                        scheduled_end: shift.scheduled_end,
                      }}
                    />
                  ) : null}
                </div>
                {shift.tablet ? <p className="mt-0.5 text-xs text-muted">Tablet {shift.tablet.number}</p> : null}
              </TD>
              <TD className={cell}>
                {shift.route ? (
                  <span className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: shift.route.color }} aria-hidden />
                    {shift.route.name}
                  </span>
                ) : (
                  <span className="text-muted">-</span>
                )}
              </TD>
              <TD className={cell}>
                {row.radio ? (
                  <div className="whitespace-nowrap">
                    <Badge tone={row.radio.alert ? "danger" : "neutral"} className="font-mono">
                      {row.radio.code}
                    </Badge>
                    <p className="mt-0.5 text-xs text-muted">
                      {row.radio.label ? `${row.radio.label} · ` : ""}
                      <Age at={row.radio.at} serverNow={serverNow} suffix=" ago" />
                    </p>
                  </div>
                ) : (
                  <span className="text-muted">-</span>
                )}
              </TD>
              <TD className={cell}>
                <BreakCell breaks={breaks} serverNow={serverNow} timeZone={timeZone} clock24h={clock24h} canReopen={canReopen} />
              </TD>
              <TD className={cell}>
                {row.pos ? (
                  <div className="whitespace-nowrap">
                    <p className="font-medium">{row.where ?? "No locations set"}</p>
                    <p className="text-xs text-muted">
                      <Age at={row.pos.at} serverNow={serverNow} staleAfterMs={STALE_AFTER_MS} suffix=" ago" />
                      {row.pos.speed !== null ? ` · ${Math.round(row.pos.speed * 2.23694)} mph` : ""}
                    </p>
                  </div>
                ) : (
                  <span className="text-muted">{shift.vehicle_id ? "No GPS yet" : "-"}</span>
                )}
              </TD>
              <TD className={cell}>
                {row.eta ? (
                  <div className="whitespace-nowrap">
                    <p className="font-medium">{row.eta.stop}</p>
                    <p className="text-xs text-muted">
                      {fmtDistance(row.eta.distance)} · {row.eta.seconds === null ? "stopped" : fmtEta(row.eta.seconds)}
                    </p>
                  </div>
                ) : (
                  <span className="text-muted">-</span>
                )}
              </TD>
              <TD className={cell}>
                {row.fatigue.length ? (
                  <div className="flex flex-wrap gap-1">
                    {row.fatigue.map((f) => (
                      <Badge key={f.id} tone={f.severity === "critical" ? "danger" : "warning"} title={f.message}>
                        {FATIGUE_LABEL[f.kind] ?? f.kind}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted">-</span>
                )}
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}

function BreakCell({
  breaks,
  serverNow,
  timeZone,
  clock24h,
  canReopen,
}: {
  breaks: BoardRow["breaks"];
  serverNow: number;
  timeZone: string;
  clock24h: boolean;
  canReopen: boolean;
}) {
  const { current, next, windowOpen, missed, taken, total } = breaks;
  return (
    <div className="flex min-w-36 flex-col gap-1">
      {current ? (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Badge tone={current.status === "overrun" ? "danger" : "primary"} dot>
            {current.status === "overrun" ? "Overrun" : `On ${BREAK_KIND_LABEL[current.kind].toLowerCase()}`}
          </Badge>
          {current.started_at ? (
            <Elapsed since={current.started_at} serverNow={serverNow} warnAfterMs={current.planned_minutes * 60_000} />
          ) : null}
        </div>
      ) : next ? (
        <p className={cn("whitespace-nowrap text-sm", windowOpen ? "font-medium text-success" : "text-fg")}>
          {BREAK_KIND_LABEL[next.kind]}{" "}
          {next.window_start ? `${fmtTime(next.window_start, timeZone, clock24h)}–${fmtTime(next.window_end, timeZone, clock24h)}` : "any time"}
          {windowOpen ? " · open" : ""}
        </p>
      ) : total ? (
        <p className="text-sm text-muted">No more planned</p>
      ) : (
        <p className="text-sm text-muted">No breaks planned</p>
      )}
      <p className="whitespace-nowrap text-xs text-muted">
        {taken}/{total} taken
      </p>
      {missed.map((b) => (
        <div key={b.id} className="flex items-center gap-2">
          <Badge tone="danger">Missed {BREAK_KIND_LABEL[b.kind].toLowerCase()}</Badge>
          {canReopen ? <ReopenBreakButton breakId={b.id} /> : null}
        </div>
      ))}
    </div>
  );
}

function AlertRail({ data, wall, serverNow, timeZone, clock24h, escalationMinutes, canReopen, canAssists, canFatigue }: Props) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Accessibility className="size-4 text-muted" aria-hidden />
              Assist requests
              {data.assists.length ? <Badge tone="danger">{data.assists.length}</Badge> : null}
            </span>
          }
          actions={
            canAssists && !wall ? (
              <Link href="/assists" className="text-sm text-primary hover:underline">
                Open
              </Link>
            ) : null
          }
        />
        {data.assists.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">No open requests.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.assists.map((a) => (
              <li key={a.id} className={cn("px-4 py-3", a.status === "escalated" && "bg-danger-soft")}>
                <div className="flex items-start justify-between gap-2">
                  <p className={cn("min-w-0 font-medium", wall && "text-lg")}>
                    {a.passenger_name}
                    {a.passenger_count > 1 ? <span className="text-muted"> +{a.passenger_count - 1}</span> : null}
                  </p>
                  {a.status === "escalated" ? <Badge tone="danger">Escalated</Badge> : <Badge tone="warning">Pending</Badge>}
                </div>
                <p className="text-sm text-muted">
                  {[a.airline?.iata_code ?? a.airline?.name, a.flight_number, a.location?.code].filter(Boolean).join(" · ") || "No flight details"}
                </p>
                <div className="mt-1 flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-muted">
                    {fullName(a.employee)}
                    {a.vehicle ? ` · ${a.vehicle.number}` : ""}
                  </span>
                  <SlaTimer createdAt={a.created_at} minutes={escalationMinutes} serverNow={serverNow} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Coffee className="size-4 text-muted" aria-hidden />
              Missed or overrun breaks
              {data.breakAlerts.length ? <Badge tone="warning">{data.breakAlerts.length}</Badge> : null}
            </span>
          }
        />
        {data.breakAlerts.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">None today.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.breakAlerts.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{fullName(b.shift.employee)}</p>
                  <p className="text-xs text-muted">
                    {BREAK_KIND_LABEL[b.kind]} ·{" "}
                    {b.status === "missed" && b.window_end
                      ? `window ended ${fmtTime(b.window_end, timeZone, clock24h)}`
                      : b.started_at
                        ? `started ${fmtTime(b.started_at, timeZone, clock24h)}`
                        : ""}
                  </p>
                </div>
                <Badge tone={BREAK_STATUS[b.status].tone}>{BREAK_STATUS[b.status].label}</Badge>
                {canReopen && b.status === "missed" && b.shift.status === "active" && !b.started_at ? (
                  <ReopenBreakButton breakId={b.id} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <HeartPulse className="size-4 text-muted" aria-hidden />
              Fatigue alerts
              {data.fatigue.length ? <Badge tone="warning">{data.fatigue.length}</Badge> : null}
            </span>
          }
          actions={
            canFatigue && !wall ? (
              <Link href="/fatigue" className="text-sm text-primary hover:underline">
                Review
              </Link>
            ) : null
          }
        />
        {data.fatigue.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">No open fatigue alerts.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.fatigue.map((f) => (
              <li key={f.id} className="px-4 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-medium">{fullName(f.employee)}</p>
                  <Badge tone={(f.severity === "critical" ? "danger" : "warning") satisfies Tone}>{FATIGUE_LABEL[f.kind] ?? f.kind}</Badge>
                </div>
                <p className="text-xs text-muted">{f.message}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
