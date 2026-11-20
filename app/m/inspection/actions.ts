"use server";

import { z } from "zod";
import { findPreviousReport, ITEM_COLUMNS } from "@/components/domain/inspection-data";
import { action, ActionError, check, zId, zOptionalText } from "@/lib/actions";
import type { AuthContext } from "@/lib/auth/session";
import { isItemActive, milesError, type PaperItem } from "@/lib/inspection";
import type { Json } from "@/lib/supabase/database.types";

const stroke = z.object({
  view: z.enum(["front", "rear", "left", "right"]),
  points: z.array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)])).min(1).max(1500),
});

const signature = z
  .array(z.object({ points: z.array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)])).min(1).max(1500) }))
  .max(60, "That signature has too many strokes. Clear it and sign again.");

const schema = z.object({
  kind: z.enum(["pre_trip", "post_trip"]),
  answers: z
    .array(
      z.object({
        itemId: zId,
        mark: z.enum(["ok", "x", "na"]).nullable(),
        psi: z.number().min(0).max(300, "PSI looks too high. Check the reading.").nullable().default(null),
        note: z.string().trim().max(300, "Keep notes under 300 characters.").default(""),
      }),
    )
    .max(500),
  odometer: z.number().int().min(0).max(9_999_999, "That odometer reading looks too high").nullable(),
  notes: zOptionalText(2000),
  damage: z.array(stroke).max(150, "Too many marks on the damage diagram. Undo some and try again."),
  signature,
  reviewedInspectionId: zId.nullable().default(null),
});
type Input = z.infer<typeof schema>;

interface ResultRow {
  item_id: string;
  category: string;
  label: string;
  critical: boolean;
  mark: "ok" | "x" | "na" | null;
  psi: number | null;
  note: string | null;
}

/** Only the items that belong on this kind of inspection get a result. */
async function buildResults(ctx: AuthContext, input: Input): Promise<ResultRow[]> {
  const items = check(
    await ctx.supabase
      .from("checklist_items")
      .select(ITEM_COLUMNS)
      .eq("organization_id", ctx.org.id)
      .eq("active", true)
      .order("sort"),
  ) as PaperItem[] | null;
  const byId = new Map(input.answers.map((a) => [a.itemId, a]));
  return (items ?? [])
    .filter((it) => isItemActive(input.kind, it))
    .map((it) => {
      const a = byId.get(it.id);
      const mark = a?.mark ?? null;
      return {
        item_id: it.id,
        category: it.category,
        label: it.label,
        critical: it.critical,
        mark,
        psi: it.psi ? (a?.psi ?? null) : null,
        note: mark === "x" && a?.note ? a.note : null,
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
    const err = milesError(pre?.odometer, input.odometer);
    if (err) throw new ActionError(err);
  }

  // The report the driver says they reviewed must be the latest one for this vehicle.
  let reviewedId: string | null = null;
  if (input.kind === "pre_trip" && input.reviewedInspectionId) {
    const prev = await findPreviousReport(ctx.supabase, ctx.org.id, shift.vehicle_id, ctx.employee.id);
    if (!prev || prev.id !== input.reviewedInspectionId) {
      throw new ActionError("There is a newer report for this vehicle. Reload the page and review it.");
    }
    reviewedId = prev.id;
  }

  const fields = {
    vehicle_id: shift.vehicle_id,
    results: results as unknown as Json,
    damage: input.damage as unknown as Json,
    odometer: input.odometer,
    notes: input.notes,
    operator_signature: input.signature as unknown as Json,
    ...(input.kind === "pre_trip" ? { reviewed_inspection_id: reviewedId } : {}),
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
  const unanswered = results.filter((r) => r.mark === null).length;
  if (unanswered) {
    throw new ActionError(`${unanswered} item${unanswered === 1 ? " still needs" : "s still need"} OK, X or NA.`);
  }
  if (results.some((r) => r.mark === "x" && !r.note)) {
    throw new ActionError("Add a short note to every item marked X so the technician knows what to fix.");
  }
  if (input.odometer === null) {
    throw new ActionError(input.kind === "pre_trip" ? "Enter the beginning miles." : "Enter the end miles.");
  }
  if (!input.signature.length) throw new ActionError("Sign the inspection before you submit it.");

  if (input.kind === "pre_trip" && !input.reviewedInspectionId) {
    const shift = check(
      await ctx.supabase
        .from("shifts")
        .select("vehicle_id")
        .eq("organization_id", ctx.org.id)
        .eq("employee_id", ctx.employee.id)
        .eq("status", "active")
        .maybeSingle(),
    );
    if (shift?.vehicle_id) {
      const prev = await findPreviousReport(ctx.supabase, ctx.org.id, shift.vehicle_id, ctx.employee.id);
      if (prev) throw new ActionError("Review the previous operator's vehicle inspection report and tick the box.");
    }
  }

  const id = await persist(ctx, input, results);
  const res = check(await ctx.supabase.rpc("submit_inspection", { p_inspection_id: id })) as {
    defects: number;
    critical: number;
  } | null;
  return { defects: res?.defects ?? 0, critical: res?.critical ?? 0 };
});

/** Technician's comments and signature on a submitted inspection. */
export const signInspection = action(
  {
    schema: z.object({
      inspectionId: zId,
      comments: zOptionalText(2000),
      signature: signature.min(1, "Add your signature."),
    }),
    capability: "defectsWork",
  },
  async ({ inspectionId, comments, signature: sig }, ctx) => {
    check(
      await ctx.supabase.rpc("sign_inspection", {
        p_inspection_id: inspectionId,
        p_comments: comments ?? "",
        p_signature: sig as unknown as Json,
      }),
    );
  },
);

