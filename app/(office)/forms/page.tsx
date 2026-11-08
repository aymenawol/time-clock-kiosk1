import { Inbox } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/session";
import { fmtAgo, fmtDateTime, fullName } from "@/lib/format";
import { FORM_META, FORM_STATUS, FORM_TYPES, type FormType } from "@/lib/forms";

export const metadata = { title: "Requests" };

export default async function FormsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requireAuth("forms");
  const sp = await searchParams;
  const type = FORM_TYPES.find((t) => t === sp.type);
  const status = sp.status && sp.status in FORM_STATUS ? sp.status : "";
  const cols = "id, employee_id, form_type, status, created_at, reviewed_at, reviewer_id";

  let pendingQ = auth.supabase
    .from("form_submissions")
    .select(cols)
    .eq("organization_id", auth.org.id)
    .eq("status", "submitted")
    .order("created_at")
    .limit(300);
  let decidedQ = auth.supabase
    .from("form_submissions")
    .select(cols)
    .eq("organization_id", auth.org.id)
    .neq("status", "submitted")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (type) {
    pendingQ = pendingQ.eq("form_type", type);
    decidedQ = decidedQ.eq("form_type", type);
  }
  if (status) decidedQ = decidedQ.eq("status", status);

  const [pending, decided] = await Promise.all([status && status !== "submitted" ? { data: [] } : pendingQ, status === "submitted" ? { data: [] } : decidedQ]);
  const rows = [...(pending.data ?? []), ...(decided.data ?? [])];
  const ids = [...new Set(rows.flatMap((r) => [r.employee_id, r.reviewer_id]).filter((x): x is string => Boolean(x)))];
  const { data: people } = ids.length
    ? await auth.supabase.from("employees").select("id, first_name, last_name, employee_number").in("id", ids)
    : { data: [] };
  const byId = new Map((people ?? []).map((p) => [p.id, p]));
  const waiting = pending.data?.length ?? 0;

  return (
    <>
      <PageHeader
        title="Requests"
        description={waiting ? `${waiting} waiting for review.` : "Nothing is waiting for review."}
      />
      <Card>
        <form method="get" className="flex flex-wrap items-end gap-3 border-b border-border p-4">
          <Select name="type" defaultValue={type ?? ""} className="w-52" aria-label="Request type">
            <option value="">All Types</option>
            {FORM_TYPES.map((t) => (
              <option key={t} value={t}>
                {FORM_META[t].label}
              </option>
            ))}
          </Select>
          <Select name="status" defaultValue={status} className="w-52" aria-label="Status">
            <option value="">All Statuses</option>
            {Object.entries(FORM_STATUS).map(([k, s]) => (
              <option key={k} value={k}>
                {s.label}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary">
            Filter
          </Button>
        </form>
        {rows.length === 0 ? (
          <EmptyState icon={Inbox} title="No requests" description="Requests from employees show up here." />
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Employee</TH>
                <TH>Request</TH>
                <TH>Status</TH>
                <TH>Submitted</TH>
                <TH>Decided</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => {
                const e = byId.get(r.employee_id);
                const st = FORM_STATUS[r.status];
                const reviewer = r.reviewer_id ? byId.get(r.reviewer_id) : null;
                return (
                  <TR key={r.id}>
                    <TD>
                      <Link href={`/forms/${r.id}`} className="flex items-center gap-3 font-medium hover:text-primary">
                        <Avatar name={fullName(e)} />
                        {fullName(e)}
                      </Link>
                    </TD>
                    <TD>{FORM_META[r.form_type as FormType]?.label ?? r.form_type}</TD>
                    <TD>
                      <Badge tone={st.tone} dot>
                        {st.label}
                      </Badge>
                    </TD>
                    <TD className="whitespace-nowrap text-muted" title={fmtDateTime(r.created_at, auth.org.timezone, auth.settings.clock24h)}>
                      {fmtAgo(r.created_at)}
                    </TD>
                    <TD className="whitespace-nowrap text-muted">
                      {r.reviewed_at ? `${fmtDateTime(r.reviewed_at, auth.org.timezone, auth.settings.clock24h)}${reviewer ? ` by ${reviewer.first_name}` : ""}` : "-"}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
