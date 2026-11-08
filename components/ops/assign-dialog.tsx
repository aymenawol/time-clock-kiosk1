"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { assignShift } from "@/app/(office)/board/actions";
import { VEHICLE_STATUS } from "@/components/domain/status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import type { VehicleStatus } from "@/lib/supabase/types";
import type { AssignOption } from "./queries";
import { toZonedInput } from "./time";

const ASSIGNABLE = new Set(["ready", "in_service"]);

export interface AssignableShift {
  id: string;
  employeeName: string;
  active: boolean;
  vehicle_id: string | null;
  tablet_id: string | null;
  route_id: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
}

export function AssignDialog({
  shift,
  options,
  timeZone,
  label = "Edit",
  compact,
}: {
  shift: AssignableShift;
  options: { vehicles: AssignOption[]; tablets: AssignOption[]; routes: AssignOption[] };
  timeZone: string;
  label?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {compact ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Edit assignment for ${shift.employeeName}`}>
            <Pencil />
          </Button>
        ) : (
          <Button variant="secondary" size="sm">
            <Pencil />
            {label}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        title={`Assignment: ${shift.employeeName}`}
        description="Vehicle, tablet, route and scheduled times for this shift."
      >
        {open ? <AssignForm shift={shift} options={options} timeZone={timeZone} onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function AssignForm({
  shift,
  options,
  timeZone,
  onDone,
}: {
  shift: AssignableShift;
  options: { vehicles: AssignOption[]; tablets: AssignOption[]; routes: AssignOption[] };
  timeZone: string;
  onDone: () => void;
}) {
  const [vehicleId, setVehicleId] = useState(shift.vehicle_id ?? "");
  const [tabletId, setTabletId] = useState(shift.tablet_id ?? "");
  const [routeId, setRouteId] = useState(shift.route_id ?? "");
  const [start, setStart] = useState(toZonedInput(shift.scheduled_start, timeZone));
  const [end, setEnd] = useState(toZonedInput(shift.scheduled_end, timeZone));
  const [run, pending, fieldErrors] = useAction(assignShift, { success: "Assignment saved", onSuccess: onDone });

  // Only active shifts are limited by the one-vehicle / one-tablet rule.
  const freeFor = (o: AssignOption) => !shift.active || !o.busyShiftId || o.busyShiftId === shift.id;
  const vehicles = options.vehicles.filter(
    (v) => v.id === shift.vehicle_id || (freeFor(v) && (!shift.active || ASSIGNABLE.has(v.status ?? ""))),
  );
  const tablets = options.tablets.filter((t) => t.id === shift.tablet_id || freeFor(t));
  const busyVehicles = shift.active ? options.vehicles.length - vehicles.length : 0;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run({ shiftId: shift.id, vehicleId, tabletId, routeId, scheduledStart: start, scheduledEnd: end });
      }}
    >
      <Field
        label="Vehicle"
        htmlFor="assign-vehicle"
        hint={busyVehicles ? `${busyVehicles} vehicle${busyVehicles === 1 ? " is" : "s are"} on another shift or not ready.` : undefined}
        error={fieldErrors.vehicleId?.[0]}
      >
        <Select id="assign-vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
          <option value="">No vehicle</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
              {v.status ? ` · ${VEHICLE_STATUS[v.status as VehicleStatus]?.label ?? v.status}` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tablet" htmlFor="assign-tablet" error={fieldErrors.tabletId?.[0]}>
          <Select id="assign-tablet" value={tabletId} onChange={(e) => setTabletId(e.target.value)}>
            <option value="">No tablet</option>
            {tablets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Route" htmlFor="assign-route" error={fieldErrors.routeId?.[0]}>
          <Select id="assign-route" value={routeId} onChange={(e) => setRouteId(e.target.value)}>
            <option value="">No route</option>
            {options.routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Scheduled start" htmlFor="assign-start" error={fieldErrors.scheduledStart?.[0]}>
          <Input id="assign-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Scheduled end" htmlFor="assign-end" error={fieldErrors.scheduledEnd?.[0]}>
          <Input id="assign-end" type="datetime-local" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      <p className="text-xs text-muted">Times are in the organization time zone ({timeZone}).</p>
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          Save assignment
        </Button>
      </div>
    </form>
  );
}
