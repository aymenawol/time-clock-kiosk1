"use server";

import { z } from "zod";
import { action, ActionError, check } from "@/lib/actions";
import type { AuthContext } from "@/lib/auth/session";
import type { Json } from "@/lib/supabase/database.types";

const schema = z.object({
  rows: z
    .array(
      z.object({
        departure_time: z.string().regex(/^(\d{2}:\d{2})?$/, "Use a valid departure time."),
        counts: z.record(z.uuid(), z.number().int().min(0).max(999)),
      }),
    )
    .max(200, "Too many rows on one sheet."),
});
type Input = z.infer<typeof schema>;

/** Create or update the caller's draft sheet for the active shift. Returns its id. */
async function persist(ctx: AuthContext, input: Input): Promise<string> {
  const shift = check(
    await ctx.supabase
      .from("shifts")
      .select("id, vehicle_id, route_id, work_date")
      .eq("organization_id", ctx.org.id)
      .eq("employee_id", ctx.employee.id)
      .eq("status", "active")
      .maybeSingle(),
  );
  if (!shift) throw new ActionError("You are not clocked in. Clock in at the kiosk first.");

  const columns = check(
    await ctx.supabase
      .from("locations")
      .select("id")
      .eq("organization_id", ctx.org.id)
      .eq("active", true)
      .eq("is_count_column", true),
  );
  const valid = new Set((columns ?? []).map((c) => c.id));

  // Keep only rows with something in them, and only known columns.
  const rows = input.rows
    .map((r) => ({
      departure_time: r.departure_time,
      counts: Object.fromEntries(Object.entries(r.counts).filter(([id, n]) => valid.has(id) && n > 0)),
    }))
    .filter((r) => r.departure_time || Object.keys(r.counts).length);

  const existing = check(
    await ctx.supabase
      .from("count_sheets")
      .select("id, status")
      .eq("organization_id", ctx.org.id)
      .eq("shift_id", shift.id)
      .maybeSingle(),
  );
  if (existing && existing.status !== "draft") throw new ActionError("This sheet was already submitted.");
  if (existing) {
    check(
      await ctx.supabase
        .from("count_sheets")
        .update({ rows: rows as unknown as Json, vehicle_id: shift.vehicle_id, route_id: shift.route_id })
        .eq("id", existing.id),
    );
    return existing.id;
  }
  const created = check(
    await ctx.supabase
      .from("count_sheets")
      .insert({
        organization_id: ctx.org.id,
        shift_id: shift.id,
        employee_id: ctx.employee.id,
        vehicle_id: shift.vehicle_id,
        route_id: shift.route_id,
        work_date: shift.work_date,
        rows: rows as unknown as Json,
      })
      .select("id")
      .single(),
  );
  if (!created) throw new ActionError("The sheet could not be saved. Try again.");
  return created.id;
}

export const saveCountSheet = action({ schema, capability: "driving" }, async (input, ctx) => {
  await persist(ctx, input);
});

export const submitCountSheet = action({ schema, capability: "driving" }, async (input, ctx) => {
  const id = await persist(ctx, input);
  check(await ctx.supabase.rpc("submit_count_sheet", { p_sheet_id: id }));
});
