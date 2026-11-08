import { Tablet } from "lucide-react";
import { DeleteButton } from "@/components/admin/action-buttons";
import { RecordEditor, type FieldDef } from "@/components/admin/record-editor";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/session";
import { deleteTablet, saveTablet } from "../actions";

export const metadata = { title: "Tablets" };

const FIELDS: FieldDef[] = [
  { name: "number", label: "Tablet number", type: "text", required: true, maxLength: 20, placeholder: "T-12" },
  { name: "serial", label: "Serial number", type: "text", maxLength: 80 },
  { name: "notes", label: "Notes", type: "textarea", maxLength: 500 },
  { name: "active", label: "Active", type: "checkbox" },
];

export default async function TabletsPage() {
  const auth = await requireAuth("settings");
  const { data } = await auth.supabase.from("tablets").select("*").eq("organization_id", auth.org.id).order("number");
  const rows = data ?? [];

  return (
    <Card>
      <CardHeader
        title="Tablets"
        description="Bus tablets that dispatch assigns to a shift. These are different from the time clock kiosks."
        actions={
          <RecordEditor title="Add tablet" fields={FIELDS} initial={{ active: true }} action={saveTablet as never} triggerLabel="Add tablet" />
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={Tablet} title="No tablets yet" description="Add the tablets that ride on your buses." />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Number</TH>
              <TH>Serial</TH>
              <TH>Notes</TH>
              <TH>Status</TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((t) => (
              <TR key={t.id}>
                <TD className="font-medium">{t.number}</TD>
                <TD className="font-mono text-muted">{t.serial || "-"}</TD>
                <TD className="max-w-72 text-muted">{t.notes || "-"}</TD>
                <TD>
                  <Badge tone={t.active ? "success" : "neutral"} dot>
                    {t.active ? "Active" : "Inactive"}
                  </Badge>
                </TD>
                <TD>
                  <div className="flex justify-end gap-1">
                    <RecordEditor
                      mode="edit"
                      title={`Edit tablet ${t.number}`}
                      id={t.id}
                      fields={FIELDS}
                      initial={{ number: t.number, serial: t.serial ?? "", notes: t.notes ?? "", active: t.active }}
                      action={saveTablet as never}
                      triggerLabel={`Edit tablet ${t.number}`}
                    />
                    <DeleteButton action={deleteTablet as never} input={{ id: t.id }} what={`tablet ${t.number}`} />
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
