"use server";

import { z } from "zod";
import { action, ActionError, audit, check, zId } from "@/lib/actions";
import { leaveDeduction } from "@/lib/forms";
import { createAdminClient } from "@/lib/supabase/admin";

export const reviewForm = action(
  {
    schema: z.object({
      id: zId,
      decision: z.enum(["approved", "denied", "returned"]),
      comment: z.string().trim().max(2000).optional(),
      leaveHours: z.union([z.literal(""), z.coerce.number().positive("Hours must be more than zero").max(2000)]).optional(),
    }),
    capability: "forms",
  },
  async (v, ctx) => {
    const { data: form } = await ctx.supabase
      .from("form_submissions")
      .select("id, form_type, payload, employee_id, status")
      .eq("id", v.id)
      .eq("organization_id", ctx.org.id)
      .maybeSingle();
    if (!form) throw new ActionError("Request not found.");
    if (form.status !== "submitted") throw new ActionError("This request was already decided.");
    if ((v.decision === "denied" || v.decision === "returned") && !v.comment) {
      throw new ActionError("Add a comment when denying or returning a request.");
    }
    if (v.decision === "approved" && form.form_type === "resignation" && ctx.employee.role !== "admin") {
      throw new ActionError("Only an admin can approve a resignation.");
    }

    const deduction = v.decision === "approved" ? leaveDeduction(form.form_type, form.payload) : null;
    const hours = deduction ? (typeof v.leaveHours === "number" ? v.leaveHours : deduction.hours) : undefined;
    check(
      await ctx.supabase.rpc("review_form", {
        p_form_id: v.id,
        p_decision: v.decision,
        p_comment: v.comment ?? "",
        ...(deduction && hours ? { p_leave_kind: deduction.kind, p_leave_hours: hours } : {}),
      }),
    );

    if (v.decision === "approved" && form.form_type === "resignation") {
      // The RPC set status = terminated; also stop the login (unless they belong to another organization).
      const admin = createAdminClient();
      const { data: emp } = await admin.from("employees").select("user_id").eq("id", form.employee_id).maybeSingle();
      if (emp?.user_id) {
        const { count } = await admin
          .from("employees")
          .select("id", { count: "exact", head: true })
          .eq("user_id", emp.user_id)
          .neq("id", form.employee_id)
          .neq("status", "terminated");
        if (!count) await admin.auth.admin.updateUserById(emp.user_id, { ban_duration: "876000h" });
      }
    }
    await audit(ctx, `form.${v.decision}`, "form_submissions", v.id, {
      form_type: form.form_type,
      employee_id: form.employee_id,
      leave: deduction && hours ? { kind: deduction.kind, hours } : null,
    });
  },
);
