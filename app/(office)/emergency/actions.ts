"use server";

import { z } from "zod";
import { action, ActionError, audit, check, zId } from "@/lib/actions";

const EMERGENCY_KINDS = ["weather", "airport", "reroute", "security", "custom"] as const;

/** Trigger the organization's emergency alert. Only one can be active at a time. */
export const triggerEmergency = action(
  {
    schema: z.object({
      kind: z.enum(EMERGENCY_KINDS),
      title: z.string().trim().min(1, "Give the alert a short title").max(120),
      message: z.string().trim().min(1, "Describe what is happening and what people should do").max(2000),
    }),
    capability: "emergencyTrigger",
  },
  async ({ kind, title, message }, ctx) => {
    const { data, error } = await ctx.supabase
      .from("emergencies")
      .insert({ organization_id: ctx.org.id, kind, title, message, active: true, triggered_by: ctx.employee.id })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") throw new ActionError("An emergency is already active. Resolve it first.");
      throw error;
    }
    await audit(ctx, "emergency.trigger", "emergencies", data.id, { kind, title });
  },
);

/** End the active emergency. */
export const resolveEmergency = action(
  { schema: z.object({ id: zId }), capability: "emergencyTrigger" },
  async ({ id }, ctx) => {
    const rows = check(
      await ctx.supabase
        .from("emergencies")
        .update({ active: false, resolved_by: ctx.employee.id, resolved_at: new Date().toISOString() })
        .eq("id", id)
        .eq("organization_id", ctx.org.id)
        .eq("active", true)
        .select("id"),
    );
    if (!rows || rows.length === 0) throw new ActionError("This emergency was already resolved.");
    await audit(ctx, "emergency.resolve", "emergencies", id);
  },
);
