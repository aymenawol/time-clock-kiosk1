import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LiveRefresh } from "@/components/realtime/use-live-refresh";
import { FilterField, FilterForm } from "@/components/records/filter-form";
import { dayRange, param, type SearchParams, ymdOr } from "@/components/records/params";
import { loadPeople } from "@/components/records/people";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/session";
import { fmtTime, todayIn } from "@/lib/format";

export const metadata: Metadata = { title: "Inspections" };

interface ResultItem {
  ok: boolean | null;
}

export default async function InspectionsPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireAuth("inspections");
  const sp = await searchParams;
  const { supabase, org, settings } = auth;
  const tz = org.timezone;
  const date = ymdOr(param(sp, "date"), todayIn(tz));
  const kind = param(sp, "kind");
  const vehicleId = param(sp, "vehicle");
  const { start, end } = dayRange(date, date, tz);

  let query = supabase
    .from("inspections")
    .select("id, kind, employee_id, vehicle_id, defect_count, submitted_at, created_at, results")
    .eq("organization_id", org.id)
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: false })
    .limit(500);
  if (kind === "pre_trip" || kind === "post_trip") query = query.eq("kind", kind);
  if (/^[0-9a-f-]{36}$/i.test(vehicleId)) query = query.eq("vehicle_id", vehicleId);

  const [inspectionsRes, vehiclesRes, people] = await Promise.all([
    query,
    supabase.from("vehicles").select("id, number").eq("organization_id", org.id).order("number"),
    loadPeople(auth),
  ]);
  const vehicles = vehiclesRes.data ?? [];
  const vehicleNumber = new Map(vehicles.map((v) => [v.id, v.number]));
  const rows = inspectionsRes.data ?? [];

  return (
    <>
      <LiveRefresh organizationId={org.id} tables={["defects"]} />
      <PageHeader title="Inspections" description={`${rows.length} inspection${rows.length === 1 ? "" : "s"}`} />
      <FilterForm clearHref="/fleet/inspections">
        <FilterField label="Date">
          <Input type="date" name="date" defaultValue={date} />
        </FilterField>
        <FilterField label="Type">
          <Select name="kind" defaultValue={kind}>
            <option value="">All Types</option>
            <option value="pre_trip">Pre-Trip</option>
            <option value="post_trip">Post-Trip</option>
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
        {rows.length === 0 ? (
          <EmptyState icon={ListChecks} title="No inspections" description="Nothing was started on this day with these filters." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Time</TH>
                <TH>Driver</TH>
                <TH>Vehicle</TH>
                <TH>Kind</TH>
                <TH className="text-right">Items failed</TH>
                <TH className="text-right">Defects</TH>
                <TH>State</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((i) => {
                const failed = (Array.isArray(i.results) ? (i.results as unknown as ResultItem[]) : []).filter((r) => r.ok === false).length;
                return (
                  <TR key={i.id}>
                    <TD className="whitespace-nowrap">
                      <Link href={`/fleet/inspections/${i.id}`} className="font-medium text-primary hover:underline">
                        {fmtTime(i.submitted_at ?? i.created_at, tz, settings.clock24h)}
                      </Link>
                    </TD>
                    <TD>{people.name(i.employee_id)}</TD>
                    <TD>
                      <Link href={`/fleet/${i.vehicle_id}`} className="hover:underline">
                        {vehicleNumber.get(i.vehicle_id) ?? "-"}
                      </Link>
                    </TD>
                    <TD>{i.kind === "pre_trip" ? "Pre-Trip" : "Post-Trip"}</TD>
                    <TD className={`text-right tabular ${failed ? "font-medium text-danger" : ""}`}>{failed}</TD>
                    <TD className="text-right tabular">{i.defect_count}</TD>
                    <TD>{i.submitted_at ? <Badge tone="success">Submitted</Badge> : <Badge tone="warning">Not submitted</Badge>}</TD>
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
