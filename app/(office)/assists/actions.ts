"use server";

import { z } from "zod";
import { action, ActionError, check, zId } from "@/lib/actions";

const OPEN = ["pending", "escalated", "acknowledged"];

/** Dispatch acknowledges an assist request with a message for the driver. */
export const acknowledgeAssist = action(
  {
    schema: z.object({ id: zId, response: z.string().trim().min(1, "Write a short reply for the driver").max(1000) }),
    capability: "assists",
  },
  async ({ id, response }, ctx) => {
    const rows = check(
      await ctx.supabase
        .from("assist_requests")
        .update({
          status: "acknowledged",
          response,
          responded_by: ctx.employee.id,
          responded_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("organization_id", ctx.org.id)
        .in("status", OPEN)
        .select("id"),
    );
    if (!rows || rows.length === 0) throw new ActionError("This request was already resolved or cancelled.");
  },
);

/** Mark an assist request as resolved. */
export const resolveAssist = action({ schema: z.object({ id: zId }), capability: "assists" }, async ({ id }, ctx) => {
  const rows = check(
    await ctx.supabase
      .from("assist_requests")
      .update({ status: "resolved", resolved_at: new Date().toISOString(), responded_by: ctx.employee.id })
      .eq("id", id)
      .eq("organization_id", ctx.org.id)
      .in("status", OPEN)
      .select("id"),
  );
  if (!rows || rows.length === 0) throw new ActionError("This request was already resolved or cancelled.");
});
