import { Radio } from "lucide-react";
import { DeleteButton } from "@/components/admin/action-buttons";
import { RecordEditor, type FieldDef } from "@/components/admin/record-editor";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { VEHICLE_STATUS, VEHICLE_STATUS_ORDER } from "@/components/domain/status";
import { OFFICE_ROLES, ROLE_LABEL } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { deleteRadioCode, saveRadioCode } from "../actions";

export const metadata = { title: "Radio codes" };

const FIELDS: FieldDef[] = [
  { name: "code", label: "Code", type: "text", required: true, maxLength: 12, placeholder: "10-8" },
  { name: "label", label: "Label", type: "text", required: true, maxLength: 60, placeholder: "In Service" },
  {
    name: "sets_vehicle_status",
    label: "Sets vehicle status to",
    type: "select",
    allowEmpty: "Don't change the vehicle",
    options: VEHICLE_STATUS_ORDER.map((s) => ({ value: s, label: VEHICLE_STATUS[s].label })),
  },
  { name: "sort", label: "Sort order", type: "number", required: true, min: 0, max: 9999, step: 1, hint: "Lowest first on the driver's screen." },
  { name: "notify_roles", label: "Notify these roles", type: "multiselect", options: OFFICE_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] })) },
  { name: "is_alert", label: "Treat as an alert on the dispatch board", type: "checkbox" },
  { name: "driver_selectable", label: "Drivers can pick this code", type: "checkbox" },
  { name: "active", label: "Active", type: "checkbox" },
];

export default async function RadioCodesPage() {
  const auth = await requireAuth("settings");
  const { data } = await auth.supabase
    .from("radio_codes")
    .select("*")
    .eq("organization_id", auth.org.id)
    .order("sort")
    .order("code");
  const rows = data ?? [];

  return (
    <Card>
      <CardHeader
        title="Radio codes"
        description="The status buttons drivers use, and what each one does."
        actions={
          <RecordEditor
            title="Add radio code"
            fields={FIELDS}
            initial={{ sort: (rows.at(-1)?.sort ?? 0) + 10, driver_selectable: true, active: true, is_alert: false, notify_roles: [], sets_vehicle_status: "" }}
            action={saveRadioCode as never}
            triggerLabel="Add code"
          />
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={Radio} title="No radio codes yet" description="Add 10-8 (in service), 10-39 (on break) and the others you use." />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Sort</TH>
              <TH>Code</TH>
              <TH>Label</TH>
              <TH>Sets vehicle to</TH>
              <TH>Notifies</TH>
              <TH>Flags</TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((c) => (
              <TR key={c.id} className={c.active ? undefined : "opacity-60"}>
                <TD className="tabular text-muted">{c.sort}</TD>
                <TD className="font-mono font-medium">{c.code}</TD>
                <TD>{c.label}</TD>
                <TD>{c.sets_vehicle_status ? VEHICLE_STATUS[c.sets_vehicle_status].label : <span className="text-muted">No change</span>}</TD>
                <TD className="text-muted">{c.notify_roles.length ? c.notify_roles.map((r) => ROLE_LABEL[r]).join(", ") : "-"}</TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {c.is_alert ? <Badge tone="danger">Alert</Badge> : null}
                    {c.driver_selectable ? null : <Badge>Office only</Badge>}
                    {c.active ? null : <Badge>Inactive</Badge>}
                  </div>
                </TD>
                <TD>
                  <div className="flex justify-end gap-1">
                    <RecordEditor
                      mode="edit"
                      title={`Edit ${c.code}`}
                      id={c.id}
                      fields={FIELDS}
                      initial={{
                        code: c.code,
                        label: c.label,
                        sets_vehicle_status: c.sets_vehicle_status ?? "",
                        sort: c.sort,
                        notify_roles: c.notify_roles,
                        is_alert: c.is_alert,
                        driver_selectable: c.driver_selectable,
                        active: c.active,
                      }}
                      action={saveRadioCode as never}
                      triggerLabel={`Edit ${c.code}`}
                    />
                    <DeleteButton action={deleteRadioCode as never} input={{ id: c.id }} what={`radio code ${c.code}`} />
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
