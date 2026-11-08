"use server";

import { z } from "zod";
import type { AuthContext } from "@/lib/auth/session";
import { action, ActionError, audit, check, zId } from "@/lib/actions";

async function close(
  ctx: AuthContext,
  id: string,
  status: "resolved" | "dismissed",
  note: string,
) {
  const updated = check(
    await ctx.supabase
      .from("fatigue_alerts")
      .update({ status, resolution_note: note, resolved_at: new Date().toISOString(), resolved_by: ctx.employee.id })
      .eq("id", id)
      .eq("organization_id", ctx.org.id)
      .eq("status", "open")
      .select("id, employee_id"),
  );
  if (!updated?.length) throw new ActionError("This alert was already handled. Refresh to see the latest.");
  await audit(ctx, `fatigue.${status}`, "fatigue_alerts", id, { note });
}

export const resolveAlert = action(
  {
    schema: z.object({ id: zId, note: z.string().trim().min(3, "Write what was done (at least 3 characters).").max(500) }),
    capability: "fatigue",
  },
  async ({ id, note }, ctx) => close(ctx, id, "resolved", note),
);

export const dismissAlert = action(
  {
    schema: z.object({ id: zId, reason: z.string().trim().min(3, "Give a reason (at least 3 characters).").max(500) }),
    capability: "fatigue",
  },
  async ({ id, reason }, ctx) => close(ctx, id, "dismissed", reason),
);
