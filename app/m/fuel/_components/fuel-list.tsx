"use client";

import { BatteryCharging, Droplets, Fuel, Sparkles } from "lucide-react";
import { useState } from "react";
import { VEHICLE_STATUS, VehicleStatusPill } from "@/components/domain/status";
import { Choice, type ChoiceOption } from "@/components/field/choice";
import { EnergyBar } from "@/components/field/energy-bar";
import { lowEnergyThreshold, suggestedService, type FuelService } from "@/components/field/rules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { useAction } from "@/components/ui/use-action";
import type { VehicleStatus } from "@/lib/supabase/types";
import { logService } from "../actions";

export interface QueueVehicle {
  id: string;
  number: string;
  vehicle_type: string;
  powertrain: string;
  status: VehicleStatus;
  energy_level: number | null;
  odometer: number | null;
}

function needs(v: QueueVehicle, low: number): { label: string; icon: React.ComponentType<{ className?: string }> }[] {
  const out: { label: string; icon: React.ComponentType<{ className?: string }> }[] = [];
  if (v.status === "needs_fuel" || v.status === "needs_fuel_wash") out.push({ label: "Fuel", icon: Fuel });
  if (v.status === "needs_wash" || v.status === "needs_fuel_wash") out.push({ label: "Wash", icon: Droplets });
  if (v.status === "charging") out.push({ label: "Charging", icon: BatteryCharging });
  if (!out.length && v.energy_level !== null && v.energy_level < low) {
    out.push(v.powertrain === "ev" ? { label: "Low battery", icon: BatteryCharging } : { label: "Low fuel", icon: Fuel });
  }
  return out;
}

export function FuelList({
  vehicles,
  lowFuelPercent,
  evChargePercent,
}: {
  vehicles: QueueVehicle[];
  lowFuelPercent: number;
  evChargePercent: number;
}) {
  const [open, setOpen] = useState<QueueVehicle | null>(null);

  if (!vehicles.length) {
    return (
      <Card>
        <EmptyState
          icon={Sparkles}
          title="Queue is clear"
          description="No vehicle needs fuel, a wash or a charge right now. New requests appear here automatically."
        />
      </Card>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {vehicles.map((v) => {
          const low = lowEnergyThreshold(v.powertrain, lowFuelPercent, evChargePercent);
          return (
            <li key={v.id}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xl font-semibold text-fg">{v.number}</p>
                    <p className="text-sm capitalize text-muted">
                      {v.vehicle_type} · {v.powertrain === "ev" ? "electric" : v.powertrain}
                    </p>
                  </div>
                  <VehicleStatusPill status={v.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {needs(v, low).map((n) => (
                    <Badge key={n.label} tone="info" className="py-1 text-sm">
                      <n.icon className="size-3.5" /> {n.label}
                    </Badge>
                  ))}
                </div>
                <EnergyBar className="mt-3" level={v.energy_level} noun={v.powertrain === "ev" ? "Battery" : "Fuel"} low={low} />
                <Button size="lg" className="mt-4 w-full" onClick={() => setOpen(v)}>
                  Log service
                </Button>
              </Card>
            </li>
          );
        })}
      </ul>
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        {open ? <ServiceDialog key={open.id} vehicle={open} onDone={() => setOpen(null)} /> : null}
      </Dialog>
    </>
  );
}

function ServiceDialog({ vehicle, onDone }: { vehicle: QueueVehicle; onDone: () => void }) {
  const isEv = vehicle.powertrain === "ev";
  const canCharge = isEv || vehicle.powertrain === "hybrid";
  const [service, setService] = useState<FuelService>(suggestedService(vehicle.status, vehicle.powertrain));
  const [energy, setEnergy] = useState(100);
  const [quantity, setQuantity] = useState("");
  const [odometer, setOdometer] = useState("");
  const [notes, setNotes] = useState("");
  const [run, pending, errors] = useAction(logService, {
    success: (d) => `Logged for vehicle ${d.number}: now ${VEHICLE_STATUS[d.status].label.toLowerCase()}`,
    onSuccess: onDone,
  });

  const options: ChoiceOption<FuelService>[] = [
    ...(!isEv ? [{ value: "fuel" as const, label: "Fuel", icon: Fuel }] : []),
    { value: "wash", label: "Wash", icon: Droplets },
    ...(canCharge ? [{ value: "charge" as const, label: "Charge", icon: BatteryCharging }] : []),
  ];
  const tracksEnergy = service !== "wash";
  const unit = service === "charge" ? "kWh" : "gal";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void run({
      vehicleId: vehicle.id,
      service,
      energyAfter: tracksEnergy ? energy : null,
      quantity: tracksEnergy && quantity !== "" ? Number(quantity) : null,
      odometer: odometer !== "" ? Number(odometer) : null,
      notes,
    });
  }

  return (
    <DialogContent title={`Log service · ${vehicle.number}`} description={`Currently ${VEHICLE_STATUS[vehicle.status].label.toLowerCase()}.`}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Choice label="Service" value={service} onChange={setService} options={options} columns={options.length as 2 | 3} />
        {tracksEnergy ? (
          <>
            <Field label={`${isEv || service === "charge" ? "Battery" : "Fuel"} level after`} htmlFor="energy" error={errors.energyAfter?.[0]}>
              <div className="flex items-center gap-3">
                <input
                  id="energy"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={energy}
                  onChange={(e) => setEnergy(Number(e.target.value))}
                  className="h-12 flex-1 accent-[var(--primary)]"
                />
                <span className="w-14 text-right font-mono text-lg font-semibold tabular">{energy}%</span>
              </div>
            </Field>
            <Field label={`Quantity (${unit})`} htmlFor="qty" hint="Optional" error={errors.quantity?.[0]}>
              <Input
                id="qty"
                inputMode="decimal"
                type="number"
                min={0}
                step="0.1"
                className="h-12 text-base"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </Field>
          </>
        ) : null}
        <Field
          label="Odometer"
          htmlFor="odo"
          hint={vehicle.odometer !== null ? `Last reading ${vehicle.odometer.toLocaleString("en-US")}` : "Optional"}
          error={errors.odometer?.[0]}
        >
          <Input
            id="odo"
            inputMode="numeric"
            type="number"
            min={0}
            className="h-12 text-base"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
          />
        </Field>
        <Field label="Notes" htmlFor="notes" hint="Optional" error={errors.notes?.[0]}>
          <Textarea id="notes" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Button type="submit" size="xl" className="w-full" loading={pending}>
          Save service
        </Button>
      </form>
    </DialogContent>
  );
}
