"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { VEHICLE_STATUS } from "@/components/domain/status";
import { Choice } from "@/components/field/choice";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import type { VehicleStatus } from "@/lib/supabase/types";
import { reportDefect } from "../actions";

type Severity = "minor" | "major" | "critical";

export function ReportDefectButton({
  vehicles,
  categories,
}: {
  vehicles: { id: string; number: string; status: VehicleStatus }[];
  categories: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" variant="secondary">
          <Plus /> Report a defect
        </Button>
      </DialogTrigger>
      {open ? <ReportForm vehicles={vehicles} categories={categories} onDone={() => setOpen(false)} /> : null}
    </Dialog>
  );
}

function ReportForm({
  vehicles,
  categories,
  onDone,
}: {
  vehicles: { id: string; number: string; status: VehicleStatus }[];
  categories: string[];
  onDone: () => void;
}) {
  const [vehicleId, setVehicleId] = useState("");
  const [category, setCategory] = useState("");
  const [item, setItem] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("minor");
  const [toShop, setToShop] = useState(false);
  const [run, pending, errors] = useAction(reportDefect, {
    success: (d) => `Defect reported on vehicle ${d.number}${d.shopped ? ". It is now in the shop." : ""}`,
    onSuccess: onDone,
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void run({ vehicleId, category, item, description, severity, toShop: severity !== "minor" && toShop });
  }

  return (
    <DialogContent title="Report a defect" description="Technicians and dispatch are notified.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Vehicle" htmlFor="rd-vehicle" error={errors.vehicleId?.[0]}>
          <Select id="rd-vehicle" required className="h-12 text-base" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="" disabled>
              Choose a vehicle
            </option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.number} · {VEHICLE_STATUS[v.status].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Category" htmlFor="rd-category" error={errors.category?.[0]}>
          <Input
            id="rd-category"
            required
            maxLength={60}
            list="rd-categories"
            placeholder="For example, Brakes"
            className="h-12 text-base"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <datalist id="rd-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="What is wrong?" htmlFor="rd-item" error={errors.item?.[0]}>
          <Input
            id="rd-item"
            required
            minLength={2}
            maxLength={120}
            placeholder="For example, Rear wheelchair lift sticks"
            className="h-12 text-base"
            value={item}
            onChange={(e) => setItem(e.target.value)}
          />
        </Field>
        <Field label="Details" htmlFor="rd-desc" hint="Optional" error={errors.description?.[0]}>
          <Textarea id="rd-desc" maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fg">Severity</span>
          <Choice
            label="Severity"
            value={severity}
            columns={3}
            onChange={(s) => {
              setSeverity(s);
              setToShop(s === "critical");
            }}
            options={[
              { value: "minor", label: "Minor" },
              { value: "major", label: "Major", tone: "warning" },
              { value: "critical", label: "Critical", tone: "danger" },
            ]}
          />
        </div>
        {severity !== "minor" ? (
          <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-border px-3 py-3">
            <Checkbox className="mt-0.5 size-5" checked={toShop} onChange={(e) => setToShop(e.target.checked)} />
            <span className="text-sm">
              <span className="font-medium text-fg">Take the vehicle out of service</span>
              <span className="block text-muted">Sets it to Shop until the defect is fixed.</span>
            </span>
          </label>
        ) : null}
        <Button type="submit" size="xl" className="w-full" loading={pending} disabled={!vehicleId}>
          Report defect
        </Button>
      </form>
    </DialogContent>
  );
}
