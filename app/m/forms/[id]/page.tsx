import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BackHeader } from "@/components/requests/back-header";
import { FormActions } from "@/components/requests/form-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime } from "@/lib/format";
import { describePayload, FORM_META, FORM_STATUS, type FormType } from "@/lib/forms";

export const metadata: Metadata = { title: "Request" };

export default async function FormDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const auth = await requireAuth("field");
  const { data: form } = await auth.supabase
    .from("form_submissions")
    .select("*")
    .eq("id", id)
    .eq("organization_id", auth.org.id)
    .eq("employee_id", auth.employee.id)
    .maybeSingle();
  if (!form) notFound();

  let reviewer: string | null = null;
  if (form.reviewer_id) {
    const { data } = await auth.supabase.from("employees").select("first_name, last_name").eq("id", form.reviewer_id).maybeSingle();
    if (data) reviewer = `${data.first_name} ${data.last_name}`;
  }

  const status = FORM_STATUS[form.status] ?? { label: form.status, tone: "neutral" as const };
  const rows = describePayload((form.payload ?? {}) as Record<string, unknown>);
  const tz = auth.org.timezone;

  return (
    <>
      <BackHeader
        href="/m/forms"
        backLabel="My forms"
        title={FORM_META[form.form_type as FormType]?.label ?? form.form_type}
        description={`Sent ${fmtDateTime(form.created_at, tz, auth.settings.clock24h)}`}
        actions={<Badge tone={status.tone}>{status.label}</Badge>}
      />
      <div className="flex flex-col gap-4">
        {form.reviewed_at && (form.reviewer_comment || reviewer) ? (
          <Card>
            <CardHeader
              title={form.status === "returned" ? "Returned for changes" : "Reviewer note"}
              description={`${reviewer ?? "A reviewer"}, ${fmtDateTime(form.reviewed_at, tz, auth.settings.clock24h)}`}
            />
            <CardBody>
              <p className="whitespace-pre-wrap text-sm">{form.reviewer_comment || "No comment."}</p>
            </CardBody>
          </Card>
        ) : null}
        <Card>
          <CardHeader title="Details" />
          <CardBody>
            {rows.length === 0 ? (
              <p className="text-sm text-muted">No details.</p>
            ) : (
              <dl className="flex flex-col gap-3">
                {rows.map((r) => (
                  <div key={r.label}>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">{r.label}</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm">{r.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardBody>
        </Card>
        <FormActions id={form.id} status={form.status} acknowledged={Boolean(form.acknowledged_at)} />
      </div>
    </>
  );
}
