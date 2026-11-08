import { Fuel } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { fuelFilters, loadFuelLogs } from "@/components/fleet/fuel-query";
import { CsvLink } from "@/components/records/download-button";
import { FilterField, FilterForm } from "@/components/records/filter-form";
import { qs, type SearchParams } from "@/components/records/params";
import { loadPeople } from "@/components/records/people";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Fuel log" };

const SERVICE: Record<string, string> = { fuel: "Fuel", wash: "Wash", charge: "Charge" };

export default async function FuelPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireAuth("fuelLog");
  const sp = await searchParams;
  const f = fuelFilters(auth, sp);
  const [logs, vehiclesRes, people] = await Promise.all([
    loadFuelLogs(auth, f, 500),
    auth.supabase.from("vehicles").select("id, number").eq("organization_id", auth.org.id).order("number"),
    loadPeople(auth),
  ]);
  const vehicles = vehiclesRes.data ?? [];
  const numbers = new Map(vehicles.map((v) => [v.id, v.number]));

  const sum = (service: string) =>
    logs.filter((l) => l.service === service).reduce((n, l) => n + Number(l.quantity ?? 0), 0);
  const gallons = sum("fuel");
  const kwh = sum("charge");
  const washes = logs.filter((l) => l.service === "wash").length;

  return (
    <>
      <PageHeader
        title="Fuel log"
        description="Fuel, wash and charge entries"
        actions={<CsvLink href={`/fleet/fuel/export${qs(f)}`} />}
      />
      <FilterForm clearHref="/fleet/fuel">
        <FilterField label="From">
          <Input type="date" name="from" defaultValue={f.from} />
        </FilterField>
        <FilterField label="To">
          <Input type="date" name="to" defaultValue={f.to} />
        </FilterField>
        <FilterField label="Vehicle">
          <Select name="vehicle" defaultValue={f.vehicle}>
            <option value="">All vehicles</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.number}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Service">
          <Select name="service" defaultValue={f.service}>
            <option value="">All services</option>
            <option value="fuel">Fuel</option>
            <option value="wash">Wash</option>
            <option value="charge">Charge</option>
          </Select>
        </FilterField>
      </FilterForm>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Fuel" value={`${gallons.toFixed(1)} gal`} />
        <Stat label="Charge" value={`${kwh.toFixed(1)} kWh`} />
        <Stat label="Washes" value={washes} />
        <Stat label="Entries" value={logs.length} hint={logs.length >= 500 ? "Showing the latest 500" : undefined} />
      </div>

      <Card>
        {logs.length === 0 ? (
          <EmptyState icon={Fuel} title="No entries" description="Try a wider date range." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>When</TH>
                <TH>Vehicle</TH>
                <TH>Service</TH>
                <TH className="text-right">Before</TH>
                <TH className="text-right">After</TH>
                <TH className="text-right">Amount</TH>
                <TH>By</TH>
                <TH>Notes</TH>
              </tr>
            </THead>
            <TBody>
              {logs.map((l) => (
                <TR key={l.id}>
                  <TD className="whitespace-nowrap">{fmtDateTime(l.created_at, auth.org.timezone, auth.settings.clock24h)}</TD>
                  <TD>
                    <Link href={`/fleet/${l.vehicle_id}`} className="font-semibold text-primary hover:underline">
                      {numbers.get(l.vehicle_id) ?? "-"}
                    </Link>
                  </TD>
                  <TD>
                    <Badge tone={l.service === "charge" ? "info" : l.service === "wash" ? "accent" : "primary"}>{SERVICE[l.service]}</Badge>
                  </TD>
                  <TD className="text-right tabular">{l.energy_before !== null ? `${l.energy_before}%` : "-"}</TD>
                  <TD className="text-right tabular">{l.energy_after !== null ? `${l.energy_after}%` : "-"}</TD>
                  <TD className="text-right tabular">
                    {l.quantity !== null && l.service !== "wash" ? `${l.quantity} ${l.service === "charge" ? "kWh" : "gal"}` : "-"}
                  </TD>
                  <TD>{people.name(l.employee_id)}</TD>
                  <TD className="max-w-xs truncate text-muted">{l.notes ?? ""}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
