import { Bus, Clock, Hourglass, Route as RouteIcon } from "lucide-react";
import { VehicleStatusPill } from "@/components/domain/status";
import type { ActiveShift } from "@/components/field/data";
import { energyNoun } from "@/components/field/data";
import { Elapsed } from "@/components/field/ticker";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { fmtDate, fmtMinutes, fmtTime } from "@/lib/format";

interface LastShift {
  clock_in_at: string;
  clock_out_at: string | null;
  vehicle: { number: string } | null;
}

export function ShiftCard({
  shift,
  lastShift,
  onBreak,
  isDriver,
  timeZone,
  clock24h,
}: {
  shift: ActiveShift | null;
  lastShift: LastShift | null;
  onBreak: boolean;
  isDriver: boolean;
  timeZone: string;
  clock24h: boolean;
}) {
  if (!shift) {
    return (
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted" aria-hidden>
            <Clock className="size-6" />
          </span>
          <div className="min-w-0">
            <p className="text-lg font-semibold text-fg">Not clocked in</p>
            <p className="mt-0.5 text-sm text-muted">Clock in at the kiosk with your employee number and PIN.</p>
          </div>
        </div>
        {lastShift ? (
          <div className="mt-4 rounded-[var(--radius-control)] bg-surface-2 px-3 py-2.5 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Last shift</p>
            <p className="mt-0.5 text-fg tabular">
              {fmtDate(lastShift.clock_in_at, timeZone)} · {fmtTime(lastShift.clock_in_at, timeZone, clock24h)} –{" "}
              {fmtTime(lastShift.clock_out_at, timeZone, clock24h)}
              {lastShift.clock_out_at ? (
                <span className="text-muted">
                  {" "}
                  ·{" "}
                  {fmtMinutes(
                    (new Date(lastShift.clock_out_at).getTime() - new Date(lastShift.clock_in_at).getTime()) / 60_000,
                  )}
                </span>
              ) : null}
              {lastShift.vehicle ? <span className="text-muted"> · Vehicle {lastShift.vehicle.number}</span> : null}
            </p>
          </div>
        ) : null}
      </Card>
    );
  }

  const v = shift.vehicle;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          {onBreak ? (
            <Badge tone="primary" dot>
              On break
            </Badge>
          ) : (
            <Badge tone="success" dot>
              On the clock
            </Badge>
          )}
          <p className="mt-2 font-mono text-4xl font-semibold tabular tracking-tight text-fg">
            <Elapsed since={shift.clock_in_at} />
          </p>
          <p className="mt-0.5 text-sm text-muted">
            Clocked in at {fmtTime(shift.clock_in_at, timeZone, clock24h)}
            {shift.scheduled_end ? ` · scheduled until ${fmtTime(shift.scheduled_end, timeZone, clock24h)}` : ""}
          </p>
        </div>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-success-soft text-success" aria-hidden>
          <Clock className="size-6" />
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-px border-t border-border bg-border min-[400px]:grid-cols-2">
        <div className="bg-surface px-5 py-3">
          <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
            <Bus className="size-3.5" aria-hidden /> Vehicle
          </dt>
          <dd className="mt-1">
            {v ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold text-fg">{v.number}</span>
                <VehicleStatusPill status={v.status} />
                {v.energy_level !== null ? (
                  <span className="w-full text-xs text-muted tabular">
                    {energyNoun(v.powertrain)} {v.energy_level}%
                  </span>
                ) : null}
              </div>
            ) : isDriver ? (
              <span className="flex items-center gap-1.5 text-sm text-warning">
                <Hourglass className="size-4" aria-hidden /> Waiting for dispatch to assign a vehicle
              </span>
            ) : (
              <span className="text-sm text-muted">None assigned</span>
            )}
          </dd>
        </div>
        <div className="bg-surface px-5 py-3">
          <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
            <RouteIcon className="size-3.5" aria-hidden /> Route
          </dt>
          <dd className="mt-1">
            {shift.route ? (
              <span className="flex items-center gap-2 text-lg font-semibold text-fg">
                {/* Route colours are admin-chosen data, not theme colours. */}
                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: shift.route.color }} aria-hidden />
                <span className="truncate">{shift.route.name}</span>
              </span>
            ) : (
              <span className="text-sm text-muted">{isDriver && v ? "Ask dispatch for your route" : "None assigned"}</span>
            )}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
