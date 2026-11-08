import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { BackHeader } from "@/components/requests/back-header";
import { getLeaveBalances } from "@/components/requests/data";
import { FormEditor } from "@/components/requests/form-editor";
import { requireAuth } from "@/lib/auth/session";
import { FORM_META, type FormType } from "@/lib/forms";

export const metadata: Metadata = { title: "Edit request" };

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const auth = await requireAuth("field");
  const { data: form } = await auth.supabase
    .from("form_submissions")
    .select("id, form_type, status, payload")
    .eq("id", id)
    .eq("organization_id", auth.org.id)
    .eq("employee_id", auth.employee.id)
    .maybeSingle();
  if (!form) notFound();
  if (form.status !== "returned") redirect(`/m/forms/${id}`);
  const type = form.form_type as FormType;
  const balances = type === "time_off" ? await getLeaveBalances(auth.supabase, auth.org.id, auth.employee.id) : undefined;
  return (
    <>
      <BackHeader href={`/m/forms/${id}`} backLabel="Request" title={`Edit ${FORM_META[type].label.toLowerCase()}`} />
      <FormEditor type={type} balances={balances} resubmitId={id} initialPayload={(form.payload ?? {}) as Record<string, unknown>} />
    </>
  );
}
