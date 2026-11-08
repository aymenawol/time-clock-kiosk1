import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackHeader } from "@/components/requests/back-header";
import { getLeaveBalances } from "@/components/requests/data";
import { FormEditor } from "@/components/requests/form-editor";
import { requireAuth } from "@/lib/auth/session";
import { FORM_META, FORM_TYPES, type FormType } from "@/lib/forms";

export const metadata: Metadata = { title: "New request" };

export default async function NewFormTypePage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!(FORM_TYPES as readonly string[]).includes(type)) notFound();
  const formType = type as FormType;
  const auth = await requireAuth("field");
  const balances = formType === "time_off" ? await getLeaveBalances(auth.supabase, auth.org.id, auth.employee.id) : undefined;
  return (
    <>
      <BackHeader
        href="/m/forms/new"
        backLabel="Request types"
        title={FORM_META[formType].label}
        description={FORM_META[formType].description}
      />
      <FormEditor type={formType} balances={balances} />
    </>
  );
}
