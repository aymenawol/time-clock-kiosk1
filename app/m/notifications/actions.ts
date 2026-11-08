"use server";

import { z } from "zod";
import { action, check, zId } from "@/lib/actions";

export const markNotificationRead = action({ schema: z.object({ id: zId }), capability: "field" }, async ({ id }, ctx) => {
  check(
    await ctx.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("employee_id", ctx.employee.id)
      .is("read_at", null),
  );
});

export const markAllNotificationsRead = action({ schema: z.object({}), capability: "field" }, async (_in, ctx) => {
  check(
    await ctx.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("employee_id", ctx.employee.id)
      .eq("organization_id", ctx.org.id)
      .is("read_at", null),
  );
});
