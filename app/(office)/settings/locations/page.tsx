import { MapPin } from "lucide-react";
import { DeleteButton } from "@/components/admin/action-buttons";
import { RecordEditor, type FieldDef } from "@/components/admin/record-editor";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/session";
import { deleteLocation, saveLocation } from "../actions";

export const metadata = { title: "Locations" };

const KINDS = [
  { value: "terminal", label: "Terminal" },
  { value: "depot", label: "Depot" },
  { value: "rental_car", label: "Rental car center" },
  { value: "stop", label: "Stop" },
  { value: "other", label: "Other" },
];

const FIELDS: FieldDef[] = [
  { name: "name", label: "Name", type: "text", required: true, maxLength: 80 },
  { name: "code", label: "Code", type: "text", required: true, maxLength: 12, hint: "Short code shown on counting sheets, for example T1." },
  { name: "kind", label: "Type", type: "select", required: true, options: KINDS },
  { name: "sort", label: "Sort order", type: "number", required: true, min: 0, max: 9999, step: 1, hint: "Lowest first." },
  { name: "lat", label: "Latitude", type: "number", min: -90, max: 90 },
  { name: "lng", label: "Longitude", type: "number", min: -180, max: 180 },
  { name: "radius_m", label: "Arrival radius (m)", type: "number", required: true, min: 10, max: 5000, step: 10, hint: "How close a bus must be to count as at this location." },
  { name: "is_count_column", label: "Show as a column on the passenger counting sheet", type: "checkbox" },
  { name: "active", label: "Active", type: "checkbox" },
];

export default async function LocationsPage() {
  const auth = await requireAuth("settings");
  const { data } = await auth.supabase
    .from("locations")
    .select("*")
    .eq("organization_id", auth.org.id)
    .order("sort")
    .order("name");
  const rows = data ?? [];

  return (
    <Card>
      <CardHeader
        title="Locations"
        description="Terminals, depots and stops. Routes are made of locations, and count columns come from here."
        actions={
          <RecordEditor
            title="Add location"
            fields={FIELDS}
            initial={{ kind: "terminal", sort: (rows.at(-1)?.sort ?? 0) + 10, radius_m: 200, active: true, is_count_column: false }}
            action={saveLocation as never}
            triggerLabel="Add location"
          />
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={MapPin} title="No locations yet" description="Add your terminals and depot first." />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Sort</TH>
              <TH>Name</TH>
              <TH>Code</TH>
              <TH>Type</TH>
              <TH>Count column</TH>
              <TH>Status</TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((l) => (
              <TR key={l.id}>
                <TD className="tabular text-muted">{l.sort}</TD>
                <TD className="font-medium">{l.name}</TD>
                <TD className="font-mono">{l.code}</TD>
                <TD>{KINDS.find((k) => k.value === l.kind)?.label ?? l.kind}</TD>
                <TD>{l.is_count_column ? <Badge tone="primary">Yes</Badge> : <span className="text-muted">No</span>}</TD>
                <TD>
                  <Badge tone={l.active ? "success" : "neutral"} dot>
                    {l.active ? "Active" : "Inactive"}
                  </Badge>
                </TD>
                <TD>
                  <div className="flex justify-end gap-1">
                    <RecordEditor
                      mode="edit"
                      title={`Edit ${l.name}`}
                      id={l.id}
                      fields={FIELDS}
                      initial={{
                        name: l.name,
                        code: l.code,
                        kind: l.kind,
                        sort: l.sort,
                        lat: l.lat,
                        lng: l.lng,
                        radius_m: l.radius_m,
                        is_count_column: l.is_count_column,
                        active: l.active,
                      }}
                      action={saveLocation as never}
                      triggerLabel={`Edit ${l.name}`}
                    />
                    <DeleteButton action={deleteLocation as never} input={{ id: l.id }} what={`location ${l.name}`} />
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
