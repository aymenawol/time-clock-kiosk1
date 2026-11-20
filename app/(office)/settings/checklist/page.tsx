import { ClipboardCheck } from "lucide-react";
import { DeleteButton } from "@/components/admin/action-buttons";
import { RecordEditor, type FieldDef } from "@/components/admin/record-editor";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/session";
import { deleteChecklistItem, saveChecklistItem } from "../actions";

export const metadata = { title: "Inspection checklist" };

const FIELDS: FieldDef[] = [
  { name: "category", label: "Section", type: "text", required: true, maxLength: 60, placeholder: "Vehicle Exterior Checks", hint: "The heading on the paper form. Items with the same section sit together." },
  { name: "label", label: "Item", type: "text", required: true, maxLength: 120, wide: true, placeholder: "Service brake holds on a slope" },
  {
    name: "paper_column",
    label: "Column",
    type: "select",
    options: [
      { value: "1", label: "Left" },
      { value: "2", label: "Right" },
    ],
    hint: "Which side of the section the item is printed on.",
  },
  { name: "sort", label: "Order", type: "number", required: true, min: 0, max: 9999, step: 1, hint: "Lowest first, across the whole form." },
  { name: "hint", label: "Small print", type: "text", maxLength: 80, wide: true, placeholder: "(Screens, Cables, Housing)", hint: "Shown under the item name." },
  { name: "subgroup", label: "Sub-heading", type: "text", maxLength: 40, placeholder: "AIR", hint: "Printed above a run of items, for example AIR." },
  { name: "mini", label: "Starred: also checked on the post-trip", type: "checkbox", hint: "Shown bold with an asterisk. The post-trip repeats starred items." },
  { name: "psi", label: "Takes a PSI reading", type: "checkbox" },
  { name: "pre_trip_only", label: "Pre-trip only", type: "checkbox", hint: "The post-trip box is shaded black." },
  { name: "critical", label: "Critical item", type: "checkbox", hint: "An X on a critical item puts the vehicle in the shop." },
  { name: "active", label: "Active", type: "checkbox" },
];

export default async function ChecklistPage() {
  const auth = await requireAuth("settings");
  const { data } = await auth.supabase
    .from("checklist_items")
    .select("*")
    .eq("organization_id", auth.org.id)
    .order("sort")
    .order("category");
  const rows = data ?? [];

  return (
    <Card>
      <CardHeader
        title="Inspection checklist"
        description="The paper vehicle inspection form. Drivers mark every item on the pre-trip and the starred items on the post-trip."
        actions={
          <RecordEditor
            title="Add checklist item"
            fields={FIELDS}
            initial={{ sort: (rows.at(-1)?.sort ?? 0) + 1, critical: false, active: true, paper_column: "1", mini: false, psi: false, pre_trip_only: false }}
            action={saveChecklistItem as never}
            triggerLabel="Add item"
          />
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No checklist items yet" description="Add the items a driver checks before and after a trip." />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Order</TH>
              <TH>Section</TH>
              <TH>Item</TH>
              <TH>Column</TH>
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
                <TD className="whitespace-nowrap font-medium">{c.category}</TD>
                <TD className="min-w-56">
                  {c.label}
                  {c.hint ? <span className="block text-xs text-muted">{c.hint}</span> : null}
                  {c.subgroup ? <span className="block text-xs text-muted">Under ({c.subgroup})</span> : null}
                </TD>
                <TD className="whitespace-nowrap">{c.paper_column === 2 ? "Right" : "Left"}</TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {c.critical ? <Badge tone="danger">Critical</Badge> : null}
                    {c.mini ? <Badge tone="info">Starred</Badge> : null}
                    {c.psi ? <Badge>PSI</Badge> : null}
                    {c.pre_trip_only ? <Badge>Pre-trip only</Badge> : null}
                    {c.active ? null : <Badge>Inactive</Badge>}
                  </div>
                </TD>
                <TD>
                  <div className="flex justify-end gap-1">
                    <RecordEditor
                      mode="edit"
                      title="Edit checklist item"
                      id={c.id}
                      fields={FIELDS}
                      initial={{
                        category: c.category,
                        label: c.label,
                        sort: c.sort,
                        critical: c.critical,
                        active: c.active,
                        paper_column: String(c.paper_column),
                        mini: c.mini,
                        psi: c.psi,
                        pre_trip_only: c.pre_trip_only,
                        subgroup: c.subgroup ?? "",
                        hint: c.hint ?? "",
                      }}
                      action={saveChecklistItem as never}
                      triggerLabel={`Edit ${c.label}`}
                    />
                    <DeleteButton
                      action={deleteChecklistItem as never}
                      input={{ id: c.id }}
                      what={`item ${c.label}`}
                      description="Past inspections keep their results. Mark the item inactive instead if you only want to stop asking it."
                    />
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
