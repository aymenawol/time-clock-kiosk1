import { Tablet } from "lucide-react";
import { ActionButton } from "@/components/admin/action-buttons";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/session";
import { fmtAgo, fmtDateTime } from "@/lib/format";
import { PairKiosk } from "../_components/pair-kiosk";
import { revokeKiosk } from "../actions";

export const metadata = { title: "Kiosks" };

export default async function KiosksPage() {
  const auth = await requireAuth("settings");
  const { data } = await auth.supabase
    .from("kiosk_devices")
    .select("id, name, created_at, last_seen_at, revoked_at")
    .eq("organization_id", auth.org.id)
    .order("created_at", { ascending: false });
  const devices = data ?? [];
  const tz = auth.org.timezone;
  const c24 = auth.settings.clock24h;

  return (
    <Card>
      <CardHeader
        title="Time clock kiosks"
        description="Shared tablets where employees clock in with their number and PIN."
        actions={<PairKiosk timeZone={tz} clock24h={c24} />}
      />
      {devices.length === 0 ? (
        <EmptyState icon={Tablet} title="No kiosks paired yet" description="Pair a tablet to let employees clock in with a PIN." />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Paired</TH>
              <TH>Last seen</TH>
              <TH>Status</TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {devices.map((d) => (
              <TR key={d.id}>
                <TD className="font-medium">{d.name}</TD>
                <TD className="whitespace-nowrap text-muted">{fmtDateTime(d.created_at, tz, c24)}</TD>
                <TD className="whitespace-nowrap text-muted">{d.last_seen_at ? fmtAgo(d.last_seen_at) : "Never"}</TD>
                <TD>{d.revoked_at ? <Badge tone="neutral">Revoked</Badge> : <Badge tone="success" dot>Active</Badge>}</TD>
                <TD className="text-right">
                  {d.revoked_at ? null : (
                    <ActionButton
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      action={revokeKiosk}
                      input={{ id: d.id }}
                      success="Kiosk revoked"
                      confirm={{
                        title: `Revoke ${d.name}?`,
                        description: "The tablet stops working at once. Pair it again to use it later.",
                        confirmLabel: "Revoke",
                        danger: true,
                      }}
                    >
                      Revoke
                    </ActionButton>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
