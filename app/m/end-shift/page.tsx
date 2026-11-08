import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";
import { VehicleStatusPill } from "@/components/domain/status";
import { getActiveShift } from "@/components/field/data";
import { FieldHeader, Notice } from "@/components/field/field-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime } from "@/lib/format";
import { EndShiftForm } from "./end-shift-form";

export const metadata = { title: "End of shift" };

const CONDITION_LABEL: Record<string, string> = {
  ready: "Ready for service",
  needs_charge: "Charge required",
  needs_fuel: "Needs fuel",
  shop: "Needs shop",
  hazard: "Hazard",
};

export default async function EndShiftPage() {
  const auth = await requireAuth("driving");
  const tz = auth.org.timezone;
  const shift = await getActiveShift(auth);

  // The report for the active shift, or, once clocked out, for the latest closed shift.
  let shiftId = shift?.id ?? null;
  if (!shiftId) {
    const { data } = await auth.supabase
      .from("shifts")
      .select("id")
      .eq("organization_id", auth.org.id)
      .eq("employee_id", auth.employee.id)
      .order("clock_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    shiftId = data?.id ?? null;
  }
  const reportRes = shiftId
    ? await auth.supabase
        .from("end_of_shift_reports")
        .select("condition, energy_level, odometer, notes, created_at, vehicle:vehicles(number, powertrain)")
        .eq("organization_id", auth.org.id)
        .eq("shift_id", shiftId)
        .maybeSingle()
    : null;

  if (reportRes?.error) {
    return (
      <>
        <FieldHeader title="End of shift" />
        <Notice tone="danger" icon={AlertTriangle} role="alert" title="The report could not be loaded">
          Check your connection and refresh the page.
        </Notice>
      </>
    );
  }

  const report = reportRes?.data ?? null;
  if (report) {
    const noun = report.vehicle?.powertrain === "ev" ? "Battery" : "Fuel";
    return (
      <>
        <FieldHeader title="End of shift" description={report.vehicle ? `Vehicle ${report.vehicle.number}` : undefined} />
        <div className="flex flex-col gap-4">
          <Notice tone="success" icon={CheckCircle2} title={`Submitted ${fmtDateTime(report.created_at, tz, auth.settings.clock24h)}`}>
            {shift ? "Now clock out at the kiosk to finish your shift." : "You are clocked out. See you next shift."}
          </Notice>
          <Card>
            <CardHeader title="Your report" />
            <CardBody className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted">Vehicle status</span>
                <span className="font-medium text-fg">{CONDITION_LABEL[report.condition] ?? report.condition}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted">{noun} level</span>
                <span className="font-medium text-fg tabular">{report.energy_level !== null ? `${report.energy_level}%` : "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted">Odometer</span>
                <span className="font-mono font-medium text-fg tabular">
                  {report.odometer !== null ? report.odometer.toLocaleString("en-US") : "-"}
                </span>
              </div>
              {report.notes ? <p className="whitespace-pre-line border-t border-border pt-3 text-fg">{report.notes}</p> : null}
            </CardBody>
          </Card>
          <Button asChild size="xl" variant="secondary" className="w-full">
            <Link href="/m">Back to home</Link>
          </Button>
        </div>
      </>
    );
  }

  if (!shift) {
    return (
      <>
        <FieldHeader title="End of shift" />
        <Card>
          <EmptyState
            icon={Clock}
            title="You are not clocked in"
            description="The end-of-shift report is done before you clock out. Clock in first."
          />
        </Card>
      </>
    );
  }

  if (!shift.vehicle) {
    return (
      <>
        <FieldHeader title="End of shift" />
        <Card>
          <EmptyState
            icon={Clock}
            title="No vehicle on this shift"
            description="There is no vehicle to report on. Clock out at the kiosk when you are done."
          />
        </Card>
      </>
    );
  }

  const v = shift.vehicle;
  return (
    <>
      <FieldHeader
        title="End of shift"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            Bus #{v.number}
            <VehicleStatusPill status={v.status} />
          </span>
        }
      />
      <EndShiftForm
        isEv={v.powertrain === "ev"}
        vehicleNumber={v.number}
        initialBattery={v.energy_level}
        lastOdometer={v.odometer}
      />
    </>
  );
}
