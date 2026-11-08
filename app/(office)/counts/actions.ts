"use server";

import { z } from "zod";
import { must } from "@/components/records/must";
import { action, ActionError, audit, check, zId } from "@/lib/actions";

const EDIT_ROLES = ["admin", "supervisor", "dispatcher"];

const rowSchema = z.object({
  departure_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 14:30"),
  counts: z.record(z.string(), z.number().int().min(0).max(999)),
});

export const updateCountSheet = action(
  {
    schema: z.object({
      id: zId,
      rows: z.array(rowSchema).max(60),
      reason: z.string().trim().min(3, "Give a reason for the edit").max(500),
    }),
    capability: "counts",
  },
  async ({ id, rows, reason }, ctx) => {
    if (!EDIT_ROLES.includes(ctx.employee.role)) throw new ActionError("You don't have permission to edit counting sheets.");
    const sheet = must(
      check(await ctx.supabase.from("count_sheets").select("rows, status").eq("id", id).eq("organization_id", ctx.org.id).single()),
    );
    if (sheet.status !== "submitted") throw new ActionError("Only submitted sheets can be edited here.");

    const locations = must(
      check(await ctx.supabase.from("locations").select("id").eq("organization_id", ctx.org.id).eq("is_count_column", true)),
    );
    const valid = new Set(locations.map((l) => l.id));
    for (const r of rows) {
      for (const key of Object.keys(r.counts)) {
        if (!valid.has(key)) throw new ActionError("A count column no longer exists. Reload and try again.");
      }
    }

    check(
      await ctx.supabase.from("count_sheet_revisions").insert({
        organization_id: ctx.org.id,
        sheet_id: id,
        previous_rows: sheet.rows,
        new_rows: rows,
        reason,
        edited_by: ctx.employee.id,
      }),
    );
    check(await ctx.supabase.from("count_sheets").update({ rows }).eq("id", id).eq("organization_id", ctx.org.id));
    await audit(ctx, "count_sheet.edit", "count_sheets", id, { reason });
  },
);
