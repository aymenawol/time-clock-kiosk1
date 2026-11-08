import { BatteryCharging, Droplets, Fuel, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { VEHICLE_STATUS, VEHICLE_STATUS_ORDER, VehicleStatusPill } from "@/components/domain/status";
import { Energy } from "@/components/fleet/energy";
import { StatusChangeButton } from "@/components/fleet/vehicle-forms";
import { LiveRefresh } from "@/components/realtime/use-live-refresh";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import type { Tables, VehicleStatus } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Fleet readiness" };

type Vehicle = Tables<"vehicles">;
const OUT_OF_SERVICE: VehicleStatus[] = ["shop", "repair", "pmi", "safety_hold"];

function Queue({ title, description, icon: Icon, rows, empty }: { title: string; description: string; icon: typeof Fuel; rows: Vehicle[]; empty: string }) {
  return (
  <Card>
    <CardHeader
      title={
        <span className="flex items-center gap-2">
          <Icon className="size-4 text-muted" aria-hidden />
          {title} <span className="text-muted">({rows.length})</span>
        </span>
      }
      description={description}
    />
    {rows.length === 0 ? (
      <EmptyState title={empty} className="py-8" />
    ) : (
      <ul className="divide-y divide-border">
        {rows.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
            <div className="flex items-center gap-3">
              <Link href={`/fleet/${v.id}`} className="w-14 font-semibold text-primary hover:underline">
                {v.number}
              </Link>
              <VehicleStatusPill status={v.status as VehicleStatus} />
            </div>
            <Energy value={v.energy_level} low />
          </li>
        ))}
      </ul>
    )}
  </Card>
  );
}

export default async function ReadinessPage() {
  const auth = await requireAuth("readiness");
  const { supabase, org, settings } = auth;
  const [vehiclesRes, defectsRes] = await Promise.all([
    supabase.from("vehicles").select("*").eq("organization_id", org.id).eq("active", true).neq("status", "retired").order("number"),
    supabase
      .from("defects")
      .select("vehicle_id, item, severity")
      .eq("organization_id", org.id)
      .in("status", ["open", "in_progress", "deferred"]),
  ]);
  const vehicles = vehiclesRes.data ?? [];
  const defectsBy = new Map<string, { item: string; severity: string }[]>();
  for (const d of defectsRes.data ?? []) {
    const list = defectsBy.get(d.vehicle_id) ?? [];
    list.push(d);
    defectsBy.set(d.vehicle_id, list);
  }

  const total = vehicles.length;
  const ready = vehicles.filter((v) => v.status === "ready").length;
  const availability = total ? Math.round((ready / total) * 100) : 0;
  const counts = new Map<VehicleStatus, number>();
  for (const v of vehicles) counts.set(v.status as VehicleStatus, (counts.get(v.status as VehicleStatus) ?? 0) + 1);

  const { evChargePercent, lowFuelPercent } = settings.readiness;
  const isEv = (v: Vehicle) => v.powertrain === "ev";
  const evQueue = vehicles
    .filter((v) => isEv(v) && (v.status === "charging" || (v.energy_level !== null && v.energy_level < evChargePercent)))
    .sort((a, b) => (a.energy_level ?? 101) - (b.energy_level ?? 101));
  const fuelQueue = vehicles
    .filter(
      (v) =>
        !isEv(v) &&
        (v.status === "needs_fuel" || v.status === "needs_fuel_wash" || (v.energy_level !== null && v.energy_level < lowFuelPercent)),
    )
    .sort((a, b) => (a.energy_level ?? 101) - (b.energy_level ?? 101));
  const washQueue = vehicles.filter((v) => v.status === "needs_wash" || v.status === "needs_fuel_wash");
  const outOfService = vehicles.filter((v) => OUT_OF_SERVICE.includes(v.status as VehicleStatus));
  const canSetStatus = can(auth.employee.role, "vehicleStatus");

  const tone = availability >= 80 ? "success" : availability >= 60 ? "warning" : "danger";

  return (
    <>
      <LiveRefresh organizationId={org.id} tables={["vehicles", "defects"]} />
      <PageHeader title="Fleet readiness" description="What is ready to roll and what needs attention." />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Availability" value={`${availability}%`} hint={`${ready} of ${total} ready`} tone={tone} />
        <Stat label="In service" value={counts.get("in_service") ?? 0} />
        <Stat label="Out of service" value={outOfService.length} tone={outOfService.length ? "danger" : undefined} />
        <Stat label="Open defects" value={[...defectsBy.values()].reduce((n, l) => n + l.length, 0)} tone="warning" />
      </div>

      <Card className="mb-4">
        <CardHeader title="Vehicles by status" />
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-6">
          {VEHICLE_STATUS_ORDER.filter((s) => s !== "retired").map((s) => (
            <Link key={s} href={`/fleet?status=${s}`} className="bg-surface p-3 hover:bg-surface-2">
              <p className="text-xs text-muted">{VEHICLE_STATUS[s].label}</p>
              <p className="text-xl font-semibold tabular">{counts.get(s) ?? 0}</p>
            </Link>
          ))}
        </div>
      </Card>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Queue
          title="Charge queue"
          description={`Electric, under ${evChargePercent}% or charging`}
          icon={BatteryCharging}
          rows={evQueue}
          empty="No electric vehicles need charge"
        />
        <Queue
          title="Fuel queue"
          description={`Under ${lowFuelPercent}% or flagged needs fuel`}
          icon={Fuel}
          rows={fuelQueue}
          empty="No vehicles need fuel"
        />
        <Queue title="Wash queue" description="Flagged needs wash" icon={Droplets} rows={washQueue} empty="Nothing waiting for a wash" />
      </div>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Wrench className="size-4 text-muted" aria-hidden />
              Out of service <span className="text-muted">({outOfService.length})</span>
            </span>
          }
          description="Shop, repair, PMI and safety hold"
        />
        {outOfService.length === 0 ? (
          <EmptyState title="Every vehicle is in service" className="py-8" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Vehicle</TH>
                <TH>Status</TH>
                <TH>Open defects</TH>
                {canSetStatus ? <TH className="text-right">Actions</TH> : null}
              </tr>
            </THead>
            <TBody>
              {outOfService.map((v) => {
                const defects = defectsBy.get(v.id) ?? [];
                return (
                  <TR key={v.id}>
                    <TD>
                      <Link href={`/fleet/${v.id}`} className="font-semibold text-primary hover:underline">
                        {v.number}
                      </Link>
                    </TD>
                    <TD>
                      <VehicleStatusPill status={v.status as VehicleStatus} />
                    </TD>
                    <TD className="max-w-md">
                      {defects.length === 0 ? (
                        <span className="text-muted">None</span>
                      ) : (
                        <ul className="flex flex-col gap-0.5">
                          {defects.slice(0, 4).map((d, i) => (
                            <li key={i} className={d.severity === "critical" ? "text-danger" : "text-fg"}>
                              {d.item}
                            </li>
                          ))}
                          {defects.length > 4 ? <li className="text-muted">and {defects.length - 4} more</li> : null}
                        </ul>
                      )}
                    </TD>
                    {canSetStatus ? (
                      <TD className="text-right">
                        <StatusChangeButton vehicleId={v.id} number={v.number} current={v.status as VehicleStatus} />
                      </TD>
                    ) : null}
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
