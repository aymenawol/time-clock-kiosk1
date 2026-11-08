"use server";

import { z } from "zod";
import { action, ActionError, check, zId, zOptionalText } from "@/lib/actions";
import type { AuthContext } from "@/lib/auth/session";
import type { Json } from "@/lib/supabase/database.types";

const stroke = z.object({
  view: z.enum(["front", "rear", "left", "right"]),
  points: z.array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)])).min(1).max(1500),
});

const schema = z.object({
  kind: z.enum(["pre_trip", "post_trip"]),
  answers: z
    .array(
      z.object({
        itemId: zId,
        ok: z.boolean().nullable(),
        note: z.string().trim().max(300, "Keep notes under 300 characters.").default(""),
      }),
    )
    .max(500),
  odometer: z.number().int().min(0).max(9_999_999, "That odometer reading looks too high").nullable(),
  notes: zOptionalText(2000),
  damage: z.array(stroke).max(150, "Too many marks on the damage diagram. Undo some and try again."),
});
type Input = z.infer<typeof schema>;

interface ResultRow {
  item_id: string;
  category: string;
  label: string;
  critical: boolean;
  ok: boolean | null;
  note: string | null;
}

async function buildResults(ctx: AuthContext, input: Input): Promise<ResultRow[]> {
  const items = check(
    await ctx.supabase
      .from("checklist_items")
      .select("id, category, label, critical")
      .eq("organization_id", ctx.org.id)
      .eq("active", true)
      .order("sort"),
  );
  const byId = new Map(input.answers.map((a) => [a.itemId, a]));
  return (items ?? []).map((it) => {
    const a = byId.get(it.id);
    const ok = a?.ok ?? null;
    return {
      item_id: it.id,
      category: it.category,
      label: it.label,
      critical: it.critical,
      ok,
      note: ok === false && a?.note ? a.note : null,
    };
  });
}

/** Save the caller's inspection for this shift and kind, creating it on first save. */
async function persist(ctx: AuthContext, input: Input, results: ResultRow[]): Promise<string> {
  const shift = check(
    await ctx.supabase
      .from("shifts")
      .select("id, vehicle_id")
      .eq("organization_id", ctx.org.id)
      .eq("employee_id", ctx.employee.id)
      .eq("status", "active")
      .maybeSingle(),
  );
  if (!shift) throw new ActionError("You are not clocked in. Clock in at the kiosk first.");
  if (!shift.vehicle_id) throw new ActionError("Dispatch has not assigned you a vehicle yet.");

  if (input.kind === "post_trip" && input.odometer !== null) {
    const pre = check(
      await ctx.supabase
        .from("inspections")
        .select("odometer")
        .eq("shift_id", shift.id)
        .eq("kind", "pre_trip")
        .maybeSingle(),
    );
    if (pre?.odometer != null && input.odometer < pre.odometer) {
      throw new ActionError(
        `The odometer can't be lower than at pre-trip (${pre.odometer.toLocaleString("en-US")}). Check the reading.`,
      );
    }
  }

  const fields = {
    vehicle_id: shift.vehicle_id,
    results: results as unknown as Json,
    damage: input.damage as unknown as Json,
    odometer: input.odometer,
    notes: input.notes,
  };

  const existing = check(
    await ctx.supabase
      .from("inspections")
      .select("id, submitted_at")
      .eq("organization_id", ctx.org.id)
      .eq("shift_id", shift.id)
      .eq("kind", input.kind)
      .maybeSingle(),
  );
  if (existing?.submitted_at) throw new ActionError("This inspection was already submitted.");
  if (existing) {
    check(await ctx.supabase.from("inspections").update(fields).eq("id", existing.id));
    return existing.id;
  }
  const created = check(
    await ctx.supabase
      .from("inspections")
      .insert({
        ...fields,
        organization_id: ctx.org.id,
        shift_id: shift.id,
        employee_id: ctx.employee.id,
        kind: input.kind,
      })
      .select("id")
      .single(),
  );
  if (!created) throw new ActionError("The inspection could not be saved. Try again.");
  return created.id;
}

export const saveInspection = action({ schema, capability: "driving" }, async (input, ctx) => {
  const results = await buildResults(ctx, input);
  await persist(ctx, input, results);
});

export const submitInspection = action({ schema, capability: "driving" }, async (input, ctx) => {
  const results = await buildResults(ctx, input);
  const unanswered = results.filter((r) => r.ok === null).length;
  if (unanswered) {
    throw new ActionError(`${unanswered} item${unanswered === 1 ? " still needs" : "s still need"} a pass or fail.`);
  }
  if (results.some((r) => r.ok === false && !r.note)) {
    throw new ActionError("Add a short note to every failed item so the technician knows what to fix.");
  }
  if (input.odometer === null) throw new ActionError("Enter the odometer reading.");
  const id = await persist(ctx, input, results);
  const res = check(await ctx.supabase.rpc("submit_inspection", { p_inspection_id: id })) as {
    defects: number;
    critical: number;
  } | null;
  return { defects: res?.defects ?? 0, critical: res?.critical ?? 0 };
});
