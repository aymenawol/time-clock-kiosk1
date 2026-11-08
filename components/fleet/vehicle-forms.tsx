"use client";

import { Pencil, Plus, Power, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { changeVehicleStatus, createVehicle, retireVehicle, updateVehicle } from "@/app/(office)/fleet/actions";
import { VEHICLE_STATUS } from "@/components/domain/status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import type { VehicleStatus } from "@/lib/supabase/types";

export interface VehicleFormValues {
  id?: string;
  number: string;
  vehicle_type: string;
  powertrain: string;
  capacity: number | null;
  vin: string | null;
  plate: string | null;
  energy_level: number | null;
  odometer: number | null;
  notes: string | null;
}

const EMPTY: VehicleFormValues = {
  number: "",
  vehicle_type: "bus",
  powertrain: "diesel",
  capacity: null,
  vin: null,
  plate: null,
  energy_level: null,
  odometer: null,
  notes: null,
};

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : Number(s);
};
const txt = (v: FormDataEntryValue | null) => String(v ?? "").trim();

function VehicleForm({ initial, onDone }: { initial: VehicleFormValues; onDone: () => void }) {
  const router = useRouter();
  const editing = Boolean(initial.id);
  const [create, creating, createErrors] = useAction(createVehicle, {
    success: "Vehicle added",
    onSuccess: (d) => {
      onDone();
      router.push(`/fleet/${d.id}`);
    },
  });
  const [update, updating, updateErrors] = useAction(updateVehicle, { success: "Vehicle saved", onSuccess: onDone });
  const errors = editing ? updateErrors : createErrors;
  const err = (k: string) => errors[k]?.[0];

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const values = {
          number: txt(f.get("number")),
          vehicle_type: txt(f.get("vehicle_type")),
          powertrain: txt(f.get("powertrain")) as "diesel",
          capacity: num(f.get("capacity")),
          vin: txt(f.get("vin")) || null,
          plate: txt(f.get("plate")) || null,
          energy_level: num(f.get("energy_level")),
          odometer: num(f.get("odometer")),
          notes: txt(f.get("notes")) || null,
        };
        if (editing && initial.id) await update({ id: initial.id, ...values });
        else await create(values);
      }}
    >
      <Field label="Vehicle number" htmlFor="v-number" error={err("number")}>
        <Input id="v-number" name="number" defaultValue={initial.number} required maxLength={20} />
      </Field>
      <Field label="Type" htmlFor="v-type" error={err("vehicle_type")}>
        <Input id="v-type" name="vehicle_type" defaultValue={initial.vehicle_type} required maxLength={40} list="vehicle-types" />
        <datalist id="vehicle-types">
          {["bus", "van", "shuttle", "minibus", "sedan", "cart"].map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </Field>
      <Field label="Powertrain" htmlFor="v-power">
        <Select id="v-power" name="powertrain" defaultValue={initial.powertrain}>
          <option value="diesel">Diesel</option>
          <option value="gasoline">Gasoline</option>
          <option value="cng">CNG</option>
          <option value="hybrid">Hybrid</option>
          <option value="ev">Electric</option>
        </Select>
      </Field>
      <Field label="Seats" htmlFor="v-cap" error={err("capacity")}>
        <Input id="v-cap" name="capacity" type="number" min={1} max={200} defaultValue={initial.capacity ?? ""} inputMode="numeric" />
      </Field>
      <Field label="VIN" htmlFor="v-vin" hint="Optional, 17 characters" error={err("vin")}>
        <Input id="v-vin" name="vin" defaultValue={initial.vin ?? ""} maxLength={17} className="uppercase" />
      </Field>
      <Field label="Plate" htmlFor="v-plate" error={err("plate")}>
        <Input id="v-plate" name="plate" defaultValue={initial.plate ?? ""} maxLength={20} />
      </Field>
      <Field label="Fuel or charge level (%)" htmlFor="v-energy" error={err("energy_level")}>
        <Input id="v-energy" name="energy_level" type="number" min={0} max={100} defaultValue={initial.energy_level ?? ""} inputMode="numeric" />
      </Field>
      <Field label="Odometer" htmlFor="v-odo" error={err("odometer")}>
        <Input id="v-odo" name="odometer" type="number" min={0} defaultValue={initial.odometer ?? ""} inputMode="numeric" />
      </Field>
      <Field label="Notes" htmlFor="v-notes" className="sm:col-span-2" error={err("notes")}>
        <Textarea id="v-notes" name="notes" defaultValue={initial.notes ?? ""} maxLength={2000} />
      </Field>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="submit" loading={creating || updating}>
          {editing ? "Save changes" : "Add vehicle"}
        </Button>
      </div>
    </form>
  );
}

export function AddVehicleButton() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden />
          Add vehicle
        </Button>
      </DialogTrigger>
      <DialogContent title="Add vehicle" className="max-w-2xl">
        {open ? <VehicleForm initial={EMPTY} onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

export function EditVehicleButton({ vehicle }: { vehicle: VehicleFormValues }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Pencil aria-hidden />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent title={`Edit vehicle ${vehicle.number}`} className="max-w-2xl">
        {open ? <VehicleForm initial={vehicle} onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

const SETTABLE = (Object.keys(VEHICLE_STATUS) as VehicleStatus[]).filter((s) => s !== "retired");

export function StatusChangeButton({
  vehicleId,
  number,
  current,
  size = "sm",
}: {
  vehicleId: string;
  number: string;
  current: VehicleStatus;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [run, pending, errors] = useAction(changeVehicleStatus, { success: "Status updated", onSuccess: () => setOpen(false) });
  if (current === "retired") return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size={size}>
          <RefreshCw aria-hidden />
          Change status
        </Button>
      </DialogTrigger>
      <DialogContent title={`Change status of ${number}`} description="The change and reason are recorded in the status history.">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await run({ id: vehicleId, status: txt(f.get("status")) as "ready", reason: txt(f.get("reason")) });
          }}
        >
          <Field label="New status" htmlFor="st-status" error={errors.status?.[0]}>
            <Select id="st-status" name="status" defaultValue={current === "ready" ? "shop" : "ready"}>
              {SETTABLE.map((s) => (
                <option key={s} value={s} disabled={s === current}>
                  {VEHICLE_STATUS[s].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reason" htmlFor="st-reason" error={errors.reason?.[0]}>
            <Textarea id="st-reason" name="reason" required minLength={3} maxLength={500} placeholder="What happened?" />
          </Field>
          <Button type="submit" loading={pending}>
            Update status
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RetireVehicleButton({ vehicleId, number }: { vehicleId: string; number: string }) {
  const [open, setOpen] = useState(false);
  const [run, pending, errors] = useAction(retireVehicle, { success: "Vehicle retired", onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="text-danger">
          <Power aria-hidden />
          Retire
        </Button>
      </DialogTrigger>
      <DialogContent title={`Retire vehicle ${number}?`} description="It leaves the active fleet and readiness counts. Its history stays.">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await run({ id: vehicleId, reason: txt(new FormData(e.currentTarget).get("reason")) });
          }}
        >
          <Field label="Reason" htmlFor="rt-reason" error={errors.reason?.[0]}>
            <Textarea id="rt-reason" name="reason" required minLength={3} maxLength={500} />
          </Field>
          <Button type="submit" variant="danger" loading={pending}>
            Retire vehicle
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
