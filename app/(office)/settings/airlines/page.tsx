import { Plane } from "lucide-react";
import { ActionButton, DeleteButton } from "@/components/admin/action-buttons";
import { RecordEditor, type FieldDef } from "@/components/admin/record-editor";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/session";
import { deleteAirline, saveAirline, setAirlineActive } from "../actions";

export const metadata = { title: "Airlines" };

export default async function AirlinesPage() {
  const auth = await requireAuth("settings");
  const [airlinesRes, locationsRes] = await Promise.all([
    auth.supabase.from("airlines").select("*").eq("organization_id", auth.org.id).order("name"),
    auth.supabase.from("locations").select("id, name, code").eq("organization_id", auth.org.id).eq("active", true).order("sort").order("name"),
  ]);
  const airlines = airlinesRes.data ?? [];
  const locations = locationsRes.data ?? [];
  const locName = new Map(locations.map((l) => [l.id, l.code]));

  // Same fields and order as the v0 airline form, with the IATA code added last.
  const fields: FieldDef[] = [
    { name: "name", label: "Airline name", type: "text", required: true, maxLength: 80 },
    {
      name: "location_id",
      label: "Terminal",
      type: "select",
      required: true,
      allowEmpty: "Select a terminal",
      options: locations.map((l) => ({ value: l.id, label: `${l.name} (${l.code})` })),
      hint: "Terminals come from Locations.",
    },
    { name: "phone", label: "Phone", type: "text", maxLength: 40 },
    { name: "assist_contact", label: "Wheelchair contact", type: "text", maxLength: 120 },
    { name: "notes", label: "Notes", type: "textarea", maxLength: 1000 },
    { name: "active", label: "Active", type: "checkbox" },
    { name: "iata_code", label: "IATA code", type: "text", maxLength: 3, placeholder: "UA" },
  ];

  return (
    <Card>
      <CardHeader
        title="Airlines"
        description={`${airlines.length} airline${airlines.length === 1 ? "" : "s"} configured. Drivers pick from active airlines on the 10-51 wheelchair request.`}
        actions={
          <RecordEditor
            title="New airline"
            fields={fields}
            initial={{ active: true }}
            action={saveAirline as never}
            triggerLabel="Add airline"
            disabled={locations.length === 0}
          />
        }
      />
      {airlines.length === 0 ? (
        <EmptyState
          icon={Plane}
          title="No airlines yet"
          description={locations.length === 0 ? "Add a location (terminal) first, then add airlines." : "Add the airlines you serve."}
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Airline</TH>
              <TH>Terminal</TH>
              <TH>Phone</TH>
              <TH>W/C contact</TH>
              <TH>Status</TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {airlines.map((a) => (
              <TR key={a.id}>
                <TD className="font-medium">
                  {a.name}
                  {a.iata_code ? <span className="ml-2 font-mono text-xs text-muted">{a.iata_code}</span> : null}
                </TD>
                <TD className="text-muted">{(a.location_id && locName.get(a.location_id)) || "-"}</TD>
                <TD className="text-muted">{a.phone || "—"}</TD>
                <TD className="text-muted">{a.assist_contact || "—"}</TD>
                <TD>
                  <Badge tone={a.active ? "success" : "neutral"} dot>
                    {a.active ? "Active" : "Inactive"}
                  </Badge>
                </TD>
                <TD>
                  <div className="flex items-center justify-end gap-1">
                    <RecordEditor
                      mode="edit"
                      title={`Edit ${a.name}`}
                      id={a.id}
                      fields={fields}
                      initial={{
                        name: a.name,
                        location_id: a.location_id ?? "",
                        phone: a.phone ?? "",
                        assist_contact: a.assist_contact ?? "",
                        notes: a.notes ?? "",
                        active: a.active,
                        iata_code: a.iata_code ?? "",
                      }}
                      action={saveAirline as never}
                      triggerLabel={`Edit ${a.name}`}
                    />
                    <ActionButton
                      size="sm"
                      variant="ghost"
                      action={setAirlineActive as never}
                      input={{ id: a.id, active: !a.active }}
                      success={a.active ? "Airline deactivated" : "Airline activated"}
                    >
                      {a.active ? "Deactivate" : "Activate"}
                    </ActionButton>
                    <DeleteButton action={deleteAirline as never} input={{ id: a.id }} what={`airline ${a.name}`} />
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
