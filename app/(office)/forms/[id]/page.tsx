import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormReviewPanel } from "@/components/people/form-review";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { zId } from "@/lib/actions";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime, fullName } from "@/lib/format";
import { describePayload, FORM_META, FORM_STATUS, LEAVE_LABEL, leaveDeduction, type FormType } from "@/lib/forms";

export const metadata = { title: "Request" };

export default async function FormDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("forms");
  const { id } = await params;
  if (!zId.safeParse(id).success) notFound();
  const tz = auth.org.timezone;
  const c24 = auth.settings.clock24h;

  const { data: form } = await auth.supabase
    .from("form_submissions")
    .select("*")
    .eq("id", id)
    .eq("organization_id", auth.org.id)
    .maybeSingle();
  if (!form) notFound();

  const ids = [form.employee_id, form.reviewer_id].filter((x): x is string => Boolean(x));
  const { data: people } = await auth.supabase.from("employees").select("id, first_name, last_name, employee_number, role").in("id", ids);
  const employee = people?.find((p) => p.id === form.employee_id);
  const reviewer = people?.find((p) => p.id === form.reviewer_id);

  const payload = (form.payload ?? {}) as Record<string, unknown>;
  const deduction = leaveDeduction(form.form_type, payload);
  let balance: number | null = null;
  if (deduction) {
    const { data: ledger } = await auth.supabase
      .from("leave_ledger")
      .select("hours")
      .eq("organization_id", auth.org.id)
      .eq("employee_id", form.employee_id)
      .eq("kind", deduction.kind)
      .limit(5000);
    balance = (ledger ?? []).reduce((n, r) => n + Number(r.hours), 0);
  }

  const st = FORM_STATUS[form.status];
  const meta = FORM_META[form.form_type as FormType];
  const isOwn = form.employee_id === auth.employee.id;
  const canApprove = !(form.form_type === "resignation" && auth.employee.role !== "admin");

  return (
    <>
      <Link href="/forms" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Requests
      </Link>
      <PageHeader
        title={meta?.label ?? form.form_type}
        description={`From ${fullName(employee)} (#${employee?.employee_number ?? "-"}) · submitted ${fmtDateTime(form.created_at, tz, c24)}`}
        actions={
          <Badge tone={st.tone} dot>
            {st.label}
          </Badge>
        }
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Details" actions={employee ? <Link href={`/people/${employee.id}`} className="text-sm text-primary hover:underline">View employee</Link> : null} />
          <CardBody>
            <dl className="grid gap-4 sm:grid-cols-2">
              {describePayload(payload).map((row) => (
                <div key={row.label} className={row.value.length > 60 ? "sm:col-span-2" : undefined}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">{row.label}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-sm">{row.value}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={form.status === "submitted" ? "Decision" : "Outcome"} />
          <CardBody>
            {form.status === "submitted" ? (
              isOwn ? (
                <p className="text-sm text-muted">You cannot review your own request. Ask another admin or supervisor.</p>
              ) : (
                <FormReviewPanel
                  formId={form.id}
                  canApprove={canApprove}
                  deduction={deduction ? { kindLabel: LEAVE_LABEL[deduction.kind], hours: deduction.hours } : null}
                  balance={balance}
                />
              )
            ) : (
              <div className="grid gap-3 text-sm">
                <p>
                  {st.label}
                  {reviewer ? ` by ${fullName(reviewer)}` : ""}
                  {form.reviewed_at ? ` on ${fmtDateTime(form.reviewed_at, tz, c24)}` : ""}.
                </p>
                {form.reviewer_comment ? <p className="rounded-[var(--radius-control)] bg-surface-2 p-3">{form.reviewer_comment}</p> : null}
                {deduction && balance !== null ? (
                  <p className="text-muted">
                    {LEAVE_LABEL[deduction.kind]} balance now {balance.toFixed(2)} h.
                  </p>
                ) : null}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
