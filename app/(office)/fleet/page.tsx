import { BusFront } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { VEHICLE_STATUS, VEHICLE_STATUS_ORDER, VehicleStatusPill } from "@/components/domain/status";
import { Energy, POWERTRAIN_LABEL } from "@/components/fleet/energy";
import { AddVehicleButton, StatusChangeButton } from "@/components/fleet/vehicle-forms";
import { LiveRefresh } from "@/components/realtime/use-live-refresh";
import { FilterField, FilterForm } from "@/components/records/filter-form";
import { param, type SearchParams } from "@/components/records/params";
import { loadPeople } from "@/components/records/people";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import type { VehicleStatus } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Vehicles" };

export default async function FleetPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireAuth("fleet");
  const sp = await searchParams;
  const status = param(sp, "status");
  const type = param(sp, "type");
  const q = param(sp, "q").toLowerCase();
  const showRetired = status === "retired";
  const { supabase, org } = auth;

  const [vehiclesRes, shiftsRes, defectsRes, people] = await Promise.all([
    supabase.from("vehicles").select("*").eq("organization_id", org.id).order("number"),
    supabase
      .from("shifts")
      .select("vehicle_id, employee_id")
      .eq("organization_id", org.id)
      .eq("status", "active")
      .not("vehicle_id", "is", null),
    supabase
      .from("defects")
      .select("vehicle_id")
      .eq("organization_id", org.id)
      .in("status", ["open", "in_progress", "deferred"]),
    loadPeople(auth),
  ]);

  const driverByVehicle = new Map<string, string>();
  for (const s of shiftsRes.data ?? []) {
    if (s.vehicle_id) driverByVehicle.set(s.vehicle_id, people.name(s.employee_id));
  }
  const defectCount = new Map<string, number>();
  for (const d of defectsRes.data ?? []) defectCount.set(d.vehicle_id, (defectCount.get(d.vehicle_id) ?? 0) + 1);

  const all = vehiclesRes.data ?? [];
  const types = [...new Set(all.map((v) => v.vehicle_type))].sort();
  const vehicles = all.filter(
    (v) =>
      (showRetired ? v.status === "retired" : status ? v.status === status : v.status !== "retired") &&
      (!type || v.vehicle_type === type) &&
      (!q || `${v.number} ${v.plate ?? ""} ${v.vin ?? ""}`.toLowerCase().includes(q)),
  );
  const canSetStatus = can(auth.employee.role, "vehicleStatus");

  return (
    <>
      <LiveRefresh organizationId={org.id} tables={["vehicles", "defects", "shifts"]} />
      <PageHeader
        title="Vehicles"
        description={`${all.filter((v) => v.status !== "retired").length} active vehicles`}
        actions={can(auth.employee.role, "fleetEdit") ? <AddVehicleButton /> : undefined}
      />

      <FilterForm clearHref="/fleet">
        <FilterField label="Search" className="flex-1">
          <Input name="q" defaultValue={param(sp, "q")} placeholder="Number, plate or VIN" />
        </FilterField>
        <FilterField label="Status">
          <Select name="status" defaultValue={status}>
            <option value="">All active</option>
            {VEHICLE_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {VEHICLE_STATUS[s].label}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Type">
          <Select name="type" defaultValue={type}>
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterForm>

      <Card>
        {vehicles.length === 0 ? (
          <EmptyState icon={BusFront} title="No vehicles match" description="Clear the filters or add a vehicle." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Number</TH>
                <TH>Type</TH>
                <TH>Powertrain</TH>
                <TH>Status</TH>
                <TH>Energy</TH>
                <TH className="text-right">Odometer</TH>
                <TH>Driver</TH>
                <TH className="text-right">Open defects</TH>
                {canSetStatus ? <TH className="text-right">Actions</TH> : null}
              </tr>
            </THead>
            <TBody>
              {vehicles.map((v) => {
                const defects = defectCount.get(v.id) ?? 0;
                const low =
                  v.energy_level !== null &&
                  v.energy_level < (v.powertrain === "ev" ? auth.settings.readiness.evChargePercent : auth.settings.readiness.lowFuelPercent);
                return (
                  <TR key={v.id}>
                    <TD>
                      <Link href={`/fleet/${v.id}`} className="font-semibold text-primary hover:underline">
                        {v.number}
                      </Link>
                    </TD>
                    <TD className="capitalize">{v.vehicle_type}</TD>
                    <TD>{POWERTRAIN_LABEL[v.powertrain] ?? v.powertrain}</TD>
                    <TD>
                      <VehicleStatusPill status={v.status as VehicleStatus} />
                    </TD>
                    <TD>
                      <Energy value={v.energy_level} low={low} />
                    </TD>
                    <TD className="text-right tabular">{v.odometer?.toLocaleString("en-US") ?? "-"}</TD>
                    <TD>{driverByVehicle.get(v.id) ?? <span className="text-muted">-</span>}</TD>
                    <TD className="text-right tabular">
                      {defects ? (
                        <Link href={`/fleet/defects?vehicle=${v.id}`} className="font-medium text-danger hover:underline">
                          {defects}
                        </Link>
                      ) : (
                        <span className="text-muted">0</span>
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
