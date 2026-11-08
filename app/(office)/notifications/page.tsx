import { Bell } from "lucide-react";
import type { Metadata } from "next";
import { FilterField, FilterForm } from "@/components/records/filter-form";
import { pageOf, param, qs, type SearchParams } from "@/components/records/params";
import { Pager } from "@/components/records/pager";
import { loadPeople } from "@/components/records/people";
import { SEVERITY_TONE } from "@/components/domain/status";
import { Badge, type Tone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Notifications log" };

const PAGE_SIZE = 50;
const EMAIL_TONE: Record<string, Tone> = { sent: "success", failed: "danger", pending: "warning", sending: "warning", skipped: "neutral", none: "neutral" };

export default async function NotificationsLogPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireAuth("notificationsLog");
  const sp = await searchParams;
  const { supabase, org, settings } = auth;
  const page = pageOf(param(sp, "page"));
  const kind = param(sp, "kind");
  const severity = param(sp, "severity");
  const email = param(sp, "email");
  const recipient = /^[0-9a-f-]{36}$/i.test(param(sp, "recipient")) ? param(sp, "recipient") : "";

  // Kinds present, for the filter (recent window keeps this cheap).
  const kindsRes = await supabase
    .from("notifications")
    .select("kind")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false })
    .limit(1000);
  const kinds = [...new Set((kindsRes.data ?? []).map((k) => k.kind))].sort();

  let query = supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (kind) query = query.eq("kind", kind);
  if (["info", "warning", "critical"].includes(severity)) query = query.eq("severity", severity);
  if (email) query = query.eq("email_status", email);
  if (recipient) query = query.eq("employee_id", recipient);

  const [{ data, count }, people] = await Promise.all([query, loadPeople(auth)]);
  const rows = data ?? [];
  const filters = { kind, severity, email, recipient };

  return (
    <>
      <PageHeader title="Notifications log" description={`${count ?? 0} notifications`} />
      <FilterForm clearHref="/notifications">
        <FilterField label="Kind">
          <Select name="kind" defaultValue={kind}>
            <option value="">All kinds</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Severity">
          <Select name="severity" defaultValue={severity}>
            <option value="">Any</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </Select>
        </FilterField>
        <FilterField label="Email">
          <Select name="email" defaultValue={email}>
            <option value="">Any</option>
            <option value="sent">Sent</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
            <option value="none">Not emailed</option>
          </Select>
        </FilterField>
        <FilterField label="Recipient">
          <Select name="recipient" defaultValue={recipient}>
            <option value="">Everyone</option>
            {people.list.map((p) => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterForm>

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" description="Nothing matches these filters." />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>When</TH>
                  <TH>Kind</TH>
                  <TH>Title</TH>
                  <TH>Severity</TH>
                  <TH>Recipient</TH>
                  <TH>Email</TH>
                  <TH>Read</TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((n) => (
                  <TR key={n.id}>
                    <TD className="whitespace-nowrap">{fmtDateTime(n.created_at, org.timezone, settings.clock24h)}</TD>
                    <TD className="font-mono text-xs">{n.kind}</TD>
                    <TD className="max-w-sm truncate">{n.title}</TD>
                    <TD>
                      <Badge tone={SEVERITY_TONE[n.severity] ?? "neutral"} className="capitalize">
                        {n.severity}
                      </Badge>
                    </TD>
                    <TD>{people.name(n.employee_id)}</TD>
                    <TD>
                      <Badge tone={EMAIL_TONE[n.email_status] ?? "neutral"} className="capitalize" title={n.email_error ?? undefined}>
                        {n.email_status}
                      </Badge>
                    </TD>
                    <TD className="text-muted">{n.read_at ? fmtDateTime(n.read_at, org.timezone, settings.clock24h) : "Unread"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pager page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={(p) => `/notifications${qs({ ...filters, page: p })}`} />
          </>
        )}
      </Card>
    </>
  );
}
