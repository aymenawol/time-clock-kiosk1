import { Download, Search, Users } from "lucide-react";
import Link from "next/link";
import { AddEmployee } from "@/components/people/add-employee";
import { EMPLOYEE_STATUS } from "@/components/people/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { can, ROLE_LABEL, ROLES } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { fmtLocalDate, fmtMoney, fullName } from "@/lib/format";
import { loadPinStatus } from "./pin-status";

export const metadata = { title: "Employees" };

export default async function PeoplePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requireAuth("people");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const role = ROLES.find((r) => r === sp.role);
  const status = sp.status && (sp.status in EMPLOYEE_STATUS || sp.status === "all") ? sp.status : "current";

  const { data } = await auth.supabase
    .from("employees")
    .select("id, employee_number, first_name, last_name, email, role, status, hire_date, seniority_number, user_id")
    .eq("organization_id", auth.org.id)
    .limit(5000);

  const pins = await loadPinStatus(auth);
  const canEdit = can(auth.employee.role, "peopleEdit");

  const rows = (data ?? [])
    .filter((e) => (role ? e.role === role : true))
    .filter((e) => (status === "current" ? e.status !== "terminated" : status === "all" ? true : e.status === status))
    .filter((e) =>
      q ? `${e.first_name} ${e.last_name} ${e.employee_number} ${e.email ?? ""}`.toLowerCase().includes(q) : true,
    )
    .sort(
      (a, b) =>
        (a.seniority_number ?? Infinity) - (b.seniority_number ?? Infinity) ||
        (a.hire_date ?? "9999").localeCompare(b.hire_date ?? "9999") ||
        a.last_name.localeCompare(b.last_name),
    );

  return (
    <>
      <PageHeader
        title="Employees"
        description={`${rows.length} ${rows.length === 1 ? "person" : "people"} shown, sorted by seniority.`}
        actions={
          <>
            <Button asChild variant="secondary">
              <a href="/people/export" download>
                <Download /> Export CSV
              </a>
            </Button>
            {canEdit ? <AddEmployee minimumWage={fmtMoney(auth.settings.labor.minimumWageCents * 1.5)} /> : null}
          </>
        }
      />

      <Card>
        <form method="get" className="flex flex-wrap items-end gap-3 border-b border-border p-4">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input name="q" defaultValue={sp.q ?? ""} placeholder="Search name, number or email" className="pl-9" aria-label="Search employees" />
          </div>
          <Select name="role" defaultValue={role ?? ""} className="w-40" aria-label="Role">
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
          <Select name="status" defaultValue={status} className="w-40" aria-label="Status">
            <option value="current">Current</option>
            <option value="active">Active</option>
            <option value="on_leave">On leave</option>
            <option value="terminated">Terminated</option>
            <option value="all">Everyone</option>
          </Select>
          <Button type="submit" variant="secondary">
            Filter
          </Button>
        </form>

        {rows.length === 0 ? (
          <EmptyState icon={Users} title="No employees match" description="Try a different search or clear the filters." />
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Name</TH>
                <TH>#</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH>Hired</TH>
                <TH className="text-right">Seniority</TH>
                <TH>Login</TH>
                <TH>PIN set</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((e) => {
                const st = EMPLOYEE_STATUS[e.status];
                const pin = pins?.get(e.id);
                return (
                  <TR key={e.id}>
                    <TD>
                      <Link href={`/people/${e.id}`} className="flex items-center gap-3 font-medium text-fg hover:text-primary">
                        <Avatar name={fullName(e)} />
                        <span className="min-w-0">
                          <span className="block truncate">{fullName(e)}</span>
                          {e.email ? <span className="block truncate text-xs font-normal text-muted">{e.email}</span> : null}
                        </span>
                      </Link>
                    </TD>
                    <TD className="tabular">{e.employee_number}</TD>
                    <TD>{ROLE_LABEL[e.role]}</TD>
                    <TD>
                      <Badge tone={st.tone} dot>
                        {st.label}
                      </Badge>
                    </TD>
                    <TD className="whitespace-nowrap">{fmtLocalDate(e.hire_date, "MMM d, yyyy")}</TD>
                    <TD className="tabular text-right">{e.seniority_number ?? "-"}</TD>
                    <TD>{e.user_id ? <Badge tone="primary">Yes</Badge> : <span className="text-muted">No</span>}</TD>
                    <TD>
                      {pin ? pin.pinSet ? <Badge tone="success">Yes</Badge> : <Badge tone="warning">No</Badge> : <span className="text-muted">-</span>}
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
