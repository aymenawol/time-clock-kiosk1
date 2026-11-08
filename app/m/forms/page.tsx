import { FileText, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BackHeader, LoadError } from "@/components/requests/back-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { requireAuth } from "@/lib/auth/session";
import { fmtDate } from "@/lib/format";
import { FORM_META, FORM_STATUS, type FormType } from "@/lib/forms";

export const metadata: Metadata = { title: "My forms" };

export default async function FormsPage() {
  const auth = await requireAuth("field");
  const { data: forms, error } = await auth.supabase
    .from("form_submissions")
    .select("id, form_type, status, created_at, acknowledged_at")
    .eq("organization_id", auth.org.id)
    .eq("employee_id", auth.employee.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <>
      <BackHeader
        href="/m/requests"
        backLabel="Requests"
        title="My forms"
        actions={
          <Button asChild size="lg">
            <Link href="/m/forms/new">
              <Plus aria-hidden /> New request
            </Link>
          </Button>
        }
      />
      {error ? (
        <LoadError what="your forms" />
      ) : !forms || forms.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="No requests yet"
            description="Time off, incident reports and other requests you send will show here."
            action={
              <Button asChild size="lg">
                <Link href="/m/forms/new">Start a request</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {forms.map((f) => {
            const status = FORM_STATUS[f.status] ?? { label: f.status, tone: "neutral" as const };
            const needsAck = (f.status === "approved" || f.status === "denied") && !f.acknowledged_at;
            return (
              <li key={f.id}>
                <Link
                  href={`/m/forms/${f.id}`}
                  className="flex min-h-16 items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4 hover:bg-surface-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{FORM_META[f.form_type as FormType]?.label ?? f.form_type}</span>
                    <span className="block text-sm text-muted">Sent {fmtDate(f.created_at, auth.org.timezone)}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {needsAck ? <span className="text-xs font-medium text-primary">New decision</span> : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
