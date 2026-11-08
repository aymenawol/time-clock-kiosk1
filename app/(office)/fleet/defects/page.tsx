import { Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DefectDetailButton, type DefectView } from "@/components/fleet/defect-detail";
import { DefectStatusPill, SeverityPill } from "@/components/fleet/defect-pills";
import { LiveRefresh } from "@/components/realtime/use-live-refresh";
import { FilterField, FilterForm } from "@/components/records/filter-form";
import { param, type SearchParams } from "@/components/records/params";
import { loadPeople } from "@/components/records/people";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Defects" };

export default async function DefectsPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireAuth("defects");
  const sp = await searchParams;
  const { supabase, org, settings } = auth;
  const status = param(sp, "status") || "active";
  const severity = param(sp, "severity");
  const vehicleId = param(sp, "vehicle");

  let query = supabase
    .from("defects")
    .select("*")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (status === "active") query = query.in("status", ["open", "in_progress", "deferred"]);
  else if (["open", "in_progress", "deferred", "resolved"].includes(status)) query = query.eq("status", status);
  if (["minor", "major", "critical"].includes(severity)) query = query.eq("severity", severity);
  if (/^[0-9a-f-]{36}$/i.test(vehicleId)) query = query.eq("vehicle_id", vehicleId);

  const [defectsRes, vehiclesRes, people] = await Promise.all([
    query,
    supabase.from("vehicles").select("id, number, status").eq("organization_id", org.id).order("number"),
    loadPeople(auth),
  ]);
  const defects = defectsRes.data ?? [];
  const vehicles = vehiclesRes.data ?? [];
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
  const technicians = people.list
    .filter((p) => p.role === "technician" && p.status !== "terminated")
    .map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}` }));

  // Signed URLs for the photos of the listed defects (user-scoped, so RLS applies).
  const paths = [...new Set(defects.flatMap((d) => d.photo_paths))];
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabase.storage.from("defect-photos").createSignedUrls(paths, 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
  }

  const canWork = can(auth.employee.role, "defectsWork");

  return (
    <>
      <LiveRefresh organizationId={org.id} tables={["defects"]} />
      <PageHeader title="Defects" description={`${defects.length} shown`} />
      <FilterForm clearHref="/fleet/defects">
        <FilterField label="Status">
          <Select name="status" defaultValue={status}>
            <option value="active">Not resolved</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="deferred">Deferred</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </Select>
        </FilterField>
        <FilterField label="Severity">
          <Select name="severity" defaultValue={severity}>
            <option value="">Any</option>
            <option value="critical">Critical</option>
            <option value="major">Major</option>
            <option value="minor">Minor</option>
          </Select>
        </FilterField>
        <FilterField label="Vehicle">
          <Select name="vehicle" defaultValue={vehicleId}>
            <option value="">All vehicles</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.number}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterForm>

      <Card>
        {defects.length === 0 ? (
          <EmptyState icon={Wrench} title="No defects" description="Nothing matches these filters." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Reported</TH>
                <TH>Vehicle</TH>
                <TH>Item</TH>
                <TH>Severity</TH>
                <TH>Status</TH>
                <TH>Assigned</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {defects.map((d) => {
                const v = vehicleById.get(d.vehicle_id);
                const view: DefectView = {
                  id: d.id,
                  vehicleNumber: v?.number ?? "-",
                  vehicleStatus: v?.status ?? "",
                  item: d.item,
                  category: d.category,
                  description: d.description,
                  severity: d.severity,
                  status: d.status,
                  assignedTo: d.assigned_to,
                  reportedBy: people.name(d.reported_by),
                  reportedAt: fmtDateTime(d.created_at, org.timezone, settings.clock24h),
                  resolutionNote: d.resolution_note,
                  photos: d.photo_paths.map((p) => signed.get(p)).filter((u): u is string => Boolean(u)),
                };
                return (
                  <TR key={d.id}>
                    <TD className="whitespace-nowrap">{view.reportedAt}</TD>
                    <TD>
                      <Link href={`/fleet/${d.vehicle_id}`} className="font-semibold text-primary hover:underline">
                        {view.vehicleNumber}
                      </Link>
                    </TD>
                    <TD className="max-w-xs">
                      <div className="font-medium">{d.item}</div>
                      <div className="truncate text-xs text-muted">{d.category}</div>
                    </TD>
                    <TD>
                      <SeverityPill severity={d.severity} />
                    </TD>
                    <TD>
                      <DefectStatusPill status={d.status} />
                    </TD>
                    <TD>{people.name(d.assigned_to)}</TD>
                    <TD className="text-right">
                      <DefectDetailButton defect={view} technicians={technicians} canWork={canWork} />
                    </TD>
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
