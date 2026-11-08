"use client";

import { AlertTriangle, BatteryCharging, Check, CheckCircle2, Send, Wrench, Zap } from "lucide-react";
import { useState } from "react";
import { Choice } from "@/components/field/choice";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { submitEndShift } from "./actions";

const DIESEL = [
  { value: "100", label: "Full" },
  { value: "80", label: "Over 3/4" },
  { value: "60", label: "Over 1/2" },
  { value: "20", label: "Under 1/4" },
] as const;

type Status = "ready" | "charge_required" | "shop" | "hazard";
const STATUS_TO_CONDITION = {
  ready: "ready",
  charge_required: "needs_charge",
  shop: "shop",
  hazard: "hazard",
} as const;

export function EndShiftForm({
  isEv,
  vehicleNumber,
  initialBattery,
  lastOdometer,
}: {
  isEv: boolean;
  vehicleNumber: string;
  initialBattery: number | null;
  lastOdometer: number | null;
}) {
  const [battery, setBattery] = useState(initialBattery !== null ? String(initialBattery) : "");
  const [diesel, setDiesel] = useState<string>("100");
  const [status, setStatus] = useState<Status>("ready");
  const [odometer, setOdometer] = useState("");
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  const [run, pending, errors] = useAction(submitEndShift, {
    success: "End of shift submitted",
    onSuccess: () => {
      setConfirming(false);
      setDone(true);
    },
  });

  const evPct = battery.trim() === "" ? null : Number(battery);
  const evValid = evPct !== null && Number.isFinite(evPct) && evPct >= 0 && evPct <= 100;
  const evAuto: "ready" | "charge_required" | null = evValid ? (evPct < 50 ? "charge_required" : "ready") : null;
  const batteryMissing = isEv && !evValid;

  function onBattery(v: string) {
    setBattery(v);
    const n = v.trim() === "" ? NaN : Number(v);
    // Auto-classify like v0, unless the driver already picked shop or hazard.
    if (Number.isFinite(n) && n >= 0 && n <= 100 && (status === "ready" || status === "charge_required")) {
      setStatus(n < 50 ? "charge_required" : "ready");
    }
  }

  function submit() {
    void run({
      energyLevel: isEv ? (evValid ? Math.round(evPct) : null) : Number(diesel),
      condition: STATUS_TO_CONDITION[status],
      odometer: odometer.trim() === "" ? null : Number(odometer),
      notes,
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface px-6 py-10 text-center">
        <CheckCircle2 className="size-14 text-success" aria-hidden />
        <h2 className="text-xl font-semibold text-fg">End of shift submitted</h2>
        <p className="text-sm text-muted">Bus #{vehicleNumber} status has been updated.</p>
        <p className="rounded-[var(--radius-control)] bg-primary-soft px-4 py-3 text-base font-medium text-primary">
          Now clock out at the kiosk.
        </p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!batteryMissing) setConfirming(true);
      }}
    >
      <Card>
        <CardHeader title={isEv ? "Battery level" : "Fuel level"} />
        <CardBody>
          {isEv ? (
            <Field
              label="Battery %"
              htmlFor="eos-battery"
              error={errors.energyLevel?.[0]}
              hint={
                evAuto === "ready" ? undefined : evAuto === "charge_required" ? undefined : "Enter the battery percentage, 0 to 100."
              }
            >
              <Input
                id="eos-battery"
                type="text"
                inputMode="numeric"
                required
                placeholder="0 to 100"
                className="h-12 font-mono text-lg"
                value={battery}
                onChange={(e) => onBattery(e.target.value.replace(/\D/g, "").slice(0, 3))}
              />
              {evAuto ? (
                <p
                  className={`mt-1 inline-flex items-center gap-1.5 text-sm ${evAuto === "ready" ? "text-success" : "text-warning"}`}
                  aria-live="polite"
                >
                  {evAuto === "ready" ? (
                    <>
                      <Check className="size-4" aria-hidden /> Ready for service
                    </>
                  ) : (
                    <>
                      <Zap className="size-4" aria-hidden /> Charge required (below 50%)
                    </>
                  )}
                </p>
              ) : null}
            </Field>
          ) : (
            <Choice
              label="Fuel level"
              value={diesel}
              onChange={setDiesel}
              options={DIESEL.map((d) => ({ value: d.value, label: d.label }))}
              columns={2}
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Bus status after shift" />
        <CardBody className="flex flex-col gap-3">
          {isEv && evAuto ? (
            <p className="text-xs text-muted">
              EV auto-classification: <span className="text-fg">{evAuto === "ready" ? "Ready" : "Charge required"}</span>. Change it
              below if needed.
            </p>
          ) : null}
          <Choice<Status>
            label="Bus status after shift"
            value={status}
            onChange={setStatus}
            columns={1}
            options={[
              { value: "ready", label: "Ready for service", icon: CheckCircle2, tone: "success" },
              { value: "charge_required", label: "Charge required", icon: BatteryCharging, tone: "warning" },
              { value: "shop", label: "Needs shop", icon: Wrench, tone: "danger" },
              { value: "hazard", label: "Hazard: alert dispatch", icon: AlertTriangle, tone: "danger" },
            ]}
          />
          {status === "hazard" ? (
            <p role="alert" className="flex items-center gap-1.5 text-xs text-danger">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden /> A hazard alert goes to dispatch and the supervisors right
              away.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-4">
          <Field
            label="Odometer"
            htmlFor="eos-odometer"
            hint={lastOdometer !== null ? `Last recorded ${lastOdometer.toLocaleString("en-US")}. Optional.` : "Optional"}
            error={errors.odometer?.[0]}
          >
            <Input
              id="eos-odometer"
              type="text"
              inputMode="numeric"
              className="h-12 font-mono text-lg"
              value={odometer}
              onChange={(e) => setOdometer(e.target.value.replace(/\D/g, "").slice(0, 7))}
            />
          </Field>
          <Field label="Notes (optional)" htmlFor="eos-notes" error={errors.notes?.[0]}>
            <Textarea
              id="eos-notes"
              rows={3}
              maxLength={2000}
              placeholder="Any issues, damage, or comments"
              className="resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </CardBody>
      </Card>

      <Button type="submit" size="xl" className="w-full" disabled={batteryMissing}>
        <Send /> Submit end of shift
      </Button>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent title="Submit end of shift?" description={`Bus #${vehicleNumber}. You can't change it after you submit.`}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-fg">
              {isEv ? `Battery ${evValid ? evPct : "?"}%` : `Fuel ${DIESEL.find((d) => d.value === diesel)?.label}`} ·{" "}
              {{ ready: "Ready for service", charge_required: "Charge required", shop: "Needs shop", hazard: "Hazard" }[status]}
            </p>
            <Button size="xl" className="w-full" variant={status === "hazard" ? "danger" : "primary"} loading={pending} onClick={submit}>
              <Send /> Submit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}
