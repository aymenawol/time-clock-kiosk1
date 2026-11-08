"use server";

import { z } from "zod";
import { action, ActionError, check, zId } from "@/lib/actions";
import { FORM_TYPES, formSchemas, type FormType } from "@/lib/forms";
import type { Json } from "@/lib/supabase/database.types";

const payloadSchema = z.record(z.string(), z.string().max(5000));

function validatePayload(type: FormType, payload: Record<string, string>): Json {
  const parsed = formSchemas[type].safeParse(payload);
  if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Check the form.");
  const out: Record<string, Json> = {};
  for (const [k, v] of Object.entries(parsed.data as Record<string, unknown>)) {
    if (v !== undefined && v !== null && v !== "") out[k] = v as Json;
  }
  return out;
}

export const createForm = action(
  { schema: z.object({ type: z.enum(FORM_TYPES), payload: payloadSchema }), capability: "field" },
  async ({ type, payload }, ctx) => {
    const clean = validatePayload(type, payload);
    const { data, error } = await ctx.supabase
      .from("form_submissions")
      .insert({
        organization_id: ctx.org.id,
        employee_id: ctx.employee.id,
        form_type: type,
        payload: clean,
        status: "submitted",
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id };
  },
);

export const resubmitForm = action(
  { schema: z.object({ id: zId, payload: payloadSchema }), capability: "field" },
  async ({ id, payload }, ctx) => {
    const { data: form, error } = await ctx.supabase
      .from("form_submissions")
      .select("form_type, status")
      .eq("id", id)
      .eq("employee_id", ctx.employee.id)
      .eq("organization_id", ctx.org.id)
      .maybeSingle();
    if (error) throw error;
    if (!form) throw new ActionError("Request not found.");
    if (form.status !== "returned") throw new ActionError("Only a returned request can be edited.");
    const clean = validatePayload(form.form_type as FormType, payload);
    const rows = check(
      await ctx.supabase
        .from("form_submissions")
        .update({ payload: clean, status: "submitted" })
        .eq("id", id)
        .eq("employee_id", ctx.employee.id)
        .eq("status", "returned")
        .select("id"),
    );
    if ((rows ?? []).length === 0) throw new ActionError("This request changed. Reload and try again.");
  },
);

export const withdrawForm = action({ schema: z.object({ id: zId }), capability: "field" }, async ({ id }, ctx) => {
  const rows = check(
    await ctx.supabase
      .from("form_submissions")
      .update({ status: "withdrawn" })
      .eq("id", id)
      .eq("employee_id", ctx.employee.id)
      .eq("status", "submitted")
      .select("id"),
  );
  if ((rows ?? []).length === 0) throw new ActionError("Only a request waiting for review can be withdrawn.");
});

export const acknowledgeForm = action({ schema: z.object({ id: zId }), capability: "field" }, async ({ id }, ctx) => {
  const rows = check(
    await ctx.supabase
      .from("form_submissions")
      .update({ acknowledged_at: new Date().toISOString() })
      .eq("id", id)
      .eq("employee_id", ctx.employee.id)
      .in("status", ["approved", "denied"])
      .is("acknowledged_at", null)
      .select("id"),
  );
  if ((rows ?? []).length === 0) throw new ActionError("Nothing to acknowledge.");
});
