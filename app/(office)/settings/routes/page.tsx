import { Route } from "lucide-react";
import { DeleteButton } from "@/components/admin/action-buttons";
import { RecordEditor, type FieldDef } from "@/components/admin/record-editor";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/session";
import { deleteRoute, saveRoute } from "../actions";

export const metadata = { title: "Routes" };

export default async function RoutesPage() {
  const auth = await requireAuth("settings");
  const [routesRes, locationsRes] = await Promise.all([
    auth.supabase.from("routes").select("*").eq("organization_id", auth.org.id).order("name"),
    auth.supabase.from("locations").select("id, name, code").eq("organization_id", auth.org.id).order("sort").order("name"),
  ]);
  const routes = routesRes.data ?? [];
  const locations = locationsRes.data ?? [];
  const byId = new Map(locations.map((l) => [l.id, l]));

  const fields: FieldDef[] = [
    { name: "name", label: "Route name", type: "text", required: true, maxLength: 80 },
    { name: "color", label: "Map colour", type: "color", required: true },
    {
      name: "stop_ids",
      label: "Stops, in order",
      type: "ordered",
      options: locations.map((l) => ({ value: l.id, label: `${l.name} (${l.code})` })),
    },
    { name: "active", label: "Active", type: "checkbox" },
  ];

  return (
    <Card>
      <CardHeader
        title="Routes"
        description="An ordered list of stops. The live map draws each route in its colour."
        actions={
          <RecordEditor
            title="New route"
            fields={fields}
            initial={{ color: "#095FFC", active: true, stop_ids: [] }}
            action={saveRoute as never}
            triggerLabel="Add route"
            disabled={locations.length === 0}
          />
        }
      />
      {routes.length === 0 ? (
        <EmptyState
          icon={Route}
          title="No routes yet"
          description={locations.length === 0 ? "Add locations first. Routes are made of locations." : "Add a route and choose its stops in order."}
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Route</TH>
              <TH>Stops</TH>
              <TH>Status</TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {routes.map((r) => (
              <TR key={r.id}>
                <TD className="whitespace-nowrap font-medium">
                  <span className="mr-2 inline-block size-3 rounded-full align-middle" style={{ backgroundColor: r.color }} aria-hidden />
                  {r.name}
                </TD>
                <TD className="min-w-48 text-muted">
                  {r.stop_ids.length === 0 ? "No stops" : r.stop_ids.map((id) => byId.get(id)?.code ?? "?").join(" → ")}
                </TD>
                <TD>
                  <Badge tone={r.active ? "success" : "neutral"} dot>
                    {r.active ? "Active" : "Inactive"}
                  </Badge>
                </TD>
                <TD>
                  <div className="flex justify-end gap-1">
                    <RecordEditor
                      mode="edit"
                      title={`Edit ${r.name}`}
                      id={r.id}
                      fields={fields}
                      initial={{ name: r.name, color: r.color, stop_ids: r.stop_ids, active: r.active }}
                      action={saveRoute as never}
                      triggerLabel={`Edit ${r.name}`}
                    />
                    <DeleteButton action={deleteRoute as never} input={{ id: r.id }} what={`route ${r.name}`} />
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
