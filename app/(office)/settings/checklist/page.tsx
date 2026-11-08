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
  { name: "category", label: "Category", type: "text", required: true, maxLength: 60, placeholder: "Brakes" },
  { name: "label", label: "Item", type: "text", required: true, maxLength: 120, wide: true, placeholder: "Service brake holds on a slope" },
  { name: "sort", label: "Sort order", type: "number", required: true, min: 0, max: 9999, step: 1, hint: "Lowest first." },
  { name: "critical", label: "Critical item", type: "checkbox", hint: "A failed critical item puts the vehicle in the shop." },
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
        description="Drivers complete these items on every pre-trip and post-trip inspection."
        actions={
          <RecordEditor
            title="Add checklist item"
            fields={FIELDS}
            initial={{ sort: (rows.at(-1)?.sort ?? 0) + 10, critical: false, active: true }}
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
              <TH>Sort</TH>
              <TH>Category</TH>
              <TH>Item</TH>
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
                <TD className="min-w-56">{c.label}</TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {c.critical ? <Badge tone="danger">Critical</Badge> : null}
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
                      initial={{ category: c.category, label: c.label, sort: c.sort, critical: c.critical, active: c.active }}
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
