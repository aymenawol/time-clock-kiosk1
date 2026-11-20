import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requirePlatformOperator } from "@/lib/auth/platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { NewCompanyForm } from "./new-company-form";

export default async function PlatformPage() {
  await requirePlatformOperator();
  const admin = createAdminClient();
  const [orgs, people] = await Promise.all([
    admin.from("organizations").select("id, name, slug, created_at").order("created_at", { ascending: false }),
    admin.from("employees").select("organization_id, role").eq("status", "active").limit(50000),
  ]);
  if (orgs.error) throw orgs.error;

  const counts = new Map<string, { active: number; admins: number }>();
  for (const p of people.data ?? []) {
    const c = counts.get(p.organization_id) ?? { active: 0, admins: 0 };
    c.active += 1;
    if (p.role === "admin") c.admins += 1;
    counts.set(p.organization_id, c);
  }
  const fmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/Los_Angeles" });

  return (
    <>
      <PageHeader title="Companies" description="Customer organizations on RoleCall. Create a company and its first admin here." />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="All companies" description={`${orgs.data.length} total`} />
          <Table>
            <caption className="sr-only">Companies</caption>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Slug</TH>
                <TH>Created</TH>
                <TH className="text-right">Active employees</TH>
                <TH className="text-right">Admins</TH>
              </TR>
            </THead>
            <TBody>
              {orgs.data.map((o) => {
                const c = counts.get(o.id) ?? { active: 0, admins: 0 };
                return (
                  <TR key={o.id}>
                    <TD className="font-medium">{o.name}</TD>
                    <TD>
                      <Badge tone="neutral">{o.slug}</Badge>
                    </TD>
                    <TD>{fmt.format(new Date(o.created_at))}</TD>
                    <TD className="text-right tabular-nums">{c.active}</TD>
                    <TD className="text-right tabular-nums">{c.admins}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
        <Card className="self-start">
          <CardHeader title="New company" description="Creates the company and emails its first admin an invite." />
          <CardBody>
            <NewCompanyForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
