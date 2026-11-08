import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VehicleStatusPill } from "@/components/domain/status";
import { DefectStatusPill, SeverityPill } from "@/components/fleet/defect-pills";
import { Energy, POWERTRAIN_LABEL } from "@/components/fleet/energy";
import { EditVehicleButton, RetireVehicleButton, StatusChangeButton } from "@/components/fleet/vehicle-forms";
import { LiveRefresh } from "@/components/realtime/use-live-refresh";
import { loadPeople } from "@/components/records/people";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { can } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { fmtDate, fmtDateTime, fmtTime } from "@/lib/format";
import type { VehicleStatus } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Vehicle" };

const SERVICE_LABEL: Record<string, string> = { fuel: "Fuel", wash: "Wash", charge: "Charge" };

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-fg">{children}</dd>
    </div>
  );
}

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("fleet");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, org, settings } = auth;
  const tz = org.timezone;

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .eq("organization_id", org.id)
    .maybeSingle();
  if (!vehicle) notFound();

  const [historyRes, defectsRes, inspectionsRes, fuelRes, shiftsRes, auditRes, people] = await Promise.all([
    supabase
      .from("vehicle_status_history")
      .select("*")
      .eq("vehicle_id", id)
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("defects")
      .select("*")
      .eq("vehicle_id", id)
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("inspections")
      .select("id, kind, employee_id, defect_count, submitted_at, created_at")
      .eq("vehicle_id", id)
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("fuel_logs")
      .select("*")
      .eq("vehicle_id", id)
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("shifts")
      .select("id, employee_id, work_date, clock_in_at, clock_out_at, status")
      .eq("vehicle_id", id)
      .eq("organization_id", org.id)
      .order("clock_in_at", { ascending: false })
      .limit(20),
    // Reasons for status changes are kept in the audit log (admins can read it).
    supabase
      .from("audit_events")
      .select("action, data, created_at")
      .eq("organization_id", org.id)
      .eq("entity", "vehicles")
      .eq("entity_id", id)
      .in("action", ["vehicle.status", "vehicle.retire"])
      .order("created_at", { ascending: false })
      .limit(100),
    loadPeople(auth),
  ]);

  const auditEvents = (auditRes.data ?? []).map((a) => ({
    at: new Date(a.created_at).getTime(),
    to: (a.data as { to?: string } | null)?.to ?? "retired",
    reason: (a.data as { reason?: string } | null)?.reason ?? null,
  }));
  const reasonFor = (h: { reason: string | null; to_status: string; created_at: string }) => {
    if (h.reason) return h.reason;
    const t = new Date(h.created_at).getTime();
    return auditEvents.find((a) => a.to === h.to_status && Math.abs(a.at - t) < 30_000)?.reason ?? null;
  };

  const defects = defectsRes.data ?? [];
  const openDefects = defects.filter((d) => d.status !== "resolved");
  const closedDefects = defects.filter((d) => d.status === "resolved");
  const history = historyRes.data ?? [];
  const status = vehicle.status as VehicleStatus;
  const canEdit = can(auth.employee.role, "fleetEdit");
  const lowLimit = vehicle.powertrain === "ev" ? settings.readiness.evChargePercent : settings.readiness.lowFuelPercent;

  return (
    <>
      <LiveRefresh organizationId={org.id} tables={["vehicles", "defects"]} />
      <Button asChild variant="link" className="mb-2">
        <Link href="/fleet">
          <ArrowLeft aria-hidden /> All vehicles
        </Link>
      </Button>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            Vehicle {vehicle.number}
            <VehicleStatusPill status={status} />
            {!vehicle.active ? <Badge>Inactive</Badge> : null}
          </span>
        }
        description={`${POWERTRAIN_LABEL[vehicle.powertrain] ?? vehicle.powertrain} ${vehicle.vehicle_type}${vehicle.capacity ? `, ${vehicle.capacity} seats` : ""}`}
        actions={
          <>
            {can(auth.employee.role, "vehicleStatus") ? (
              <StatusChangeButton vehicleId={vehicle.id} number={vehicle.number} current={status} size="md" />
            ) : null}
            {canEdit && status !== "retired" ? (
              <>
                <EditVehicleButton vehicle={vehicle} />
                <RetireVehicleButton vehicleId={vehicle.id} number={vehicle.number} />
              </>
            ) : null}
          </>
        }
      />

      <Card className="mb-4">
        <CardBody>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Fact label="Energy">
              <Energy value={vehicle.energy_level} low={vehicle.energy_level !== null && vehicle.energy_level < lowLimit} />
            </Fact>
            <Fact label="Odometer">{vehicle.odometer?.toLocaleString("en-US") ?? "-"}</Fact>
            <Fact label="Plate">{vehicle.plate ?? "-"}</Fact>
            <Fact label="VIN">
              <span className="break-all font-mono text-xs">{vehicle.vin ?? "-"}</span>
            </Fact>
            <Fact label="Open defects">{openDefects.length}</Fact>
            <Fact label="Added">{fmtDate(vehicle.created_at, tz, "MMM d, yyyy")}</Fact>
          </dl>
          {vehicle.notes ? <p className="mt-4 whitespace-pre-wrap text-sm text-muted">{vehicle.notes}</p> : null}
        </CardBody>
      </Card>

      <Tabs defaultValue="history">
        <TabsList className="mb-3">
          <TabsTrigger value="history">Status history</TabsTrigger>
          <TabsTrigger value="open">Open defects ({openDefects.length})</TabsTrigger>
          <TabsTrigger value="closed">Closed defects ({closedDefects.length})</TabsTrigger>
          <TabsTrigger value="inspections">Inspections</TabsTrigger>
          <TabsTrigger value="fuel">Fuel and charge</TabsTrigger>
          <TabsTrigger value="shifts">Recent shifts</TabsTrigger>
        </TabsList>

        <Card>
          <TabsContent value="history">
            {history.length === 0 ? (
              <EmptyState title="No status changes yet" />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>When</TH>
                    <TH>From</TH>
                    <TH>To</TH>
                    <TH>By</TH>
                    <TH>Reason</TH>
                  </tr>
                </THead>
                <TBody>
                  {history.map((h) => (
                    <TR key={h.id}>
                      <TD className="whitespace-nowrap">{fmtDateTime(h.created_at, tz, settings.clock24h)}</TD>
                      <TD>{h.from_status ? <VehicleStatusPill status={h.from_status as VehicleStatus} /> : "-"}</TD>
                      <TD>
                        <VehicleStatusPill status={h.to_status as VehicleStatus} />
                      </TD>
                      <TD>{h.changed_by ? people.name(h.changed_by) : "System"}</TD>
                      <TD className="max-w-md text-muted">{reasonFor(h) ?? "-"}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </TabsContent>

          {(["open", "closed"] as const).map((kind) => {
            const rows = kind === "open" ? openDefects : closedDefects;
            return (
              <TabsContent key={kind} value={kind}>
                {rows.length === 0 ? (
                  <EmptyState title={kind === "open" ? "No open defects" : "No closed defects"} />
                ) : (
                  <Table>
                    <THead>
                      <tr>
                        <TH>Reported</TH>
                        <TH>Item</TH>
                        <TH>Severity</TH>
                        <TH>Status</TH>
                        <TH>Assigned</TH>
                        <TH>{kind === "open" ? "Description" : "Resolution"}</TH>
                      </tr>
                    </THead>
                    <TBody>
                      {rows.map((d) => (
                        <TR key={d.id}>
                          <TD className="whitespace-nowrap">{fmtDateTime(d.created_at, tz, settings.clock24h)}</TD>
                          <TD>
                            <Link href={`/fleet/defects?vehicle=${vehicle.id}`} className="font-medium text-primary hover:underline">
                              {d.item}
                            </Link>
                            <div className="text-xs text-muted">{d.category}</div>
                          </TD>
                          <TD>
                            <SeverityPill severity={d.severity} />
                          </TD>
                          <TD>
                            <DefectStatusPill status={d.status} />
                          </TD>
                          <TD>{people.name(d.assigned_to)}</TD>
                          <TD className="max-w-sm text-muted">{(kind === "open" ? d.description : d.resolution_note) ?? "-"}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </TabsContent>
            );
          })}

          <TabsContent value="inspections">
            {(inspectionsRes.data ?? []).length === 0 ? (
              <EmptyState title="No inspections yet" />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>When</TH>
                    <TH>Kind</TH>
                    <TH>Driver</TH>
                    <TH className="text-right">Defects</TH>
                    <TH>State</TH>
                  </tr>
                </THead>
                <TBody>
                  {(inspectionsRes.data ?? []).map((i) => (
                    <TR key={i.id}>
                      <TD className="whitespace-nowrap">
                        <Link href={`/fleet/inspections/${i.id}`} className="font-medium text-primary hover:underline">
                          {fmtDateTime(i.submitted_at ?? i.created_at, tz, settings.clock24h)}
                        </Link>
                      </TD>
                      <TD>{i.kind === "pre_trip" ? "Pre-trip" : "Post-trip"}</TD>
                      <TD>{people.name(i.employee_id)}</TD>
                      <TD className="text-right tabular">{i.defect_count}</TD>
                      <TD>{i.submitted_at ? <Badge tone="success">Submitted</Badge> : <Badge tone="warning">Draft</Badge>}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="fuel">
            {(fuelRes.data ?? []).length === 0 ? (
              <EmptyState title="No fuel, wash or charge entries" />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>When</TH>
                    <TH>Service</TH>
                    <TH className="text-right">Before</TH>
                    <TH className="text-right">After</TH>
                    <TH className="text-right">Amount</TH>
                    <TH>By</TH>
                  </tr>
                </THead>
                <TBody>
                  {(fuelRes.data ?? []).map((f) => (
                    <TR key={f.id}>
                      <TD className="whitespace-nowrap">{fmtDateTime(f.created_at, tz, settings.clock24h)}</TD>
                      <TD>{SERVICE_LABEL[f.service] ?? f.service}</TD>
                      <TD className="text-right tabular">{f.energy_before !== null ? `${f.energy_before}%` : "-"}</TD>
                      <TD className="text-right tabular">{f.energy_after !== null ? `${f.energy_after}%` : "-"}</TD>
                      <TD className="text-right tabular">
                        {f.quantity !== null && f.service !== "wash" ? `${f.quantity} ${f.service === "charge" ? "kWh" : "gal"}` : "-"}
                      </TD>
                      <TD>{people.name(f.employee_id)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="shifts">
            {(shiftsRes.data ?? []).length === 0 ? (
              <EmptyState title="No shifts with this vehicle" />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Driver</TH>
                    <TH>Date</TH>
                    <TH>In</TH>
                    <TH>Out</TH>
                  </tr>
                </THead>
                <TBody>
                  {(shiftsRes.data ?? []).map((s) => (
                    <TR key={s.id}>
                      <TD>{people.name(s.employee_id)}</TD>
                      <TD>{fmtDate(s.clock_in_at, tz)}</TD>
                      <TD className="tabular">{fmtTime(s.clock_in_at, tz, settings.clock24h)}</TD>
                      <TD className="tabular">
                        {s.clock_out_at ? fmtTime(s.clock_out_at, tz, settings.clock24h) : <Badge tone="primary">On shift</Badge>}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </TabsContent>
        </Card>
      </Tabs>
    </>
  );
}
