"use server";

import { z } from "zod";
import { action, ActionError, audit, check, zId, zOptionalText } from "@/lib/actions";
import type { AuthContext } from "@/lib/auth/session";
import { fromZonedInput, isLocalInput, YMD } from "@/lib/scheduling/datetime";

const zLocal = z.string().refine(isLocalInput, "Enter a date and time.");
const zYmd = z.string().regex(YMD, "Enter a date.");
const zTime = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Enter a time.");

const cycleFields = z
  .object({
    name: z.string().trim().min(1, "Enter a name.").max(120),
    description: zOptionalText(2000),
    starts_on: zYmd,
    ends_on: zYmd,
    opens_at: zLocal,
    closes_at: zLocal,
    max_choices: z.coerce.number().int().min(1, "Allow at least 1 choice.").max(10, "At most 10 choices."),
  })
  .refine((v) => v.ends_on >= v.starts_on, { path: ["ends_on"], message: "The schedule must end on or after it starts." })
  .refine((v) => v.closes_at > v.opens_at, { path: ["closes_at"], message: "Bidding must close after it opens." });

async function loadCycle(ctx: AuthContext, id: string) {
  const cycle = check(
    await ctx.supabase.from("bid_cycles").select("*").eq("id", id).eq("organization_id", ctx.org.id).maybeSingle(),
  );
  if (!cycle) throw new ActionError("That bid cycle no longer exists.");
  return cycle;
}

export const createCycle = action({ schema: cycleFields, capability: "bids" }, async (v, ctx) => {
  const row = check(
    await ctx.supabase
      .from("bid_cycles")
      .insert({
        organization_id: ctx.org.id,
        name: v.name,
        description: v.description,
        starts_on: v.starts_on,
        ends_on: v.ends_on,
        opens_at: fromZonedInput(v.opens_at, ctx.org.timezone).toISOString(),
        closes_at: fromZonedInput(v.closes_at, ctx.org.timezone).toISOString(),
        max_choices: v.max_choices,
        created_by: ctx.employee.id,
      })
      .select("id")
      .single(),
  );
  if (!row) throw new ActionError("The bid cycle was not created. Try again.");
  await audit(ctx, "bid_cycle.create", "bid_cycles", row.id, { name: v.name });
  return { id: row.id };
});

export const updateCycle = action(
  { schema: z.intersection(z.object({ id: zId }), cycleFields), capability: "bids" },
  async (v, ctx) => {
    const cycle = await loadCycle(ctx, v.id);
    if (cycle.status !== "draft" && cycle.status !== "open") {
      throw new ActionError("Details can only change while the cycle is a draft or open.");
    }
    check(
      await ctx.supabase
        .from("bid_cycles")
        .update({
          name: v.name,
          description: v.description,
          starts_on: v.starts_on,
          ends_on: v.ends_on,
          opens_at: fromZonedInput(v.opens_at, ctx.org.timezone).toISOString(),
          closes_at: fromZonedInput(v.closes_at, ctx.org.timezone).toISOString(),
          max_choices: v.max_choices,
        })
        .eq("id", v.id)
        .eq("organization_id", ctx.org.id),
    );
    await audit(ctx, "bid_cycle.update", "bid_cycles", v.id, { name: v.name });
  },
);

const TRANSITIONS: Record<string, string[]> = {
  draft: ["open"],
  open: ["closed", "draft"],
  closed: ["open"],
  awarded: [],
};

export const setCycleStatus = action(
  { schema: z.object({ id: zId, to: z.enum(["draft", "open", "closed"]) }), capability: "bids" },
  async ({ id, to }, ctx) => {
    const cycle = await loadCycle(ctx, id);
    if (!TRANSITIONS[cycle.status]?.includes(to)) {
      throw new ActionError(`A ${cycle.status} cycle can't move to ${to}. Refresh and try again.`);
    }
    if (to === "open") {
      const { count } = await ctx.supabase
        .from("bid_lines")
        .select("id", { count: "exact", head: true })
        .eq("cycle_id", id)
        .eq("organization_id", ctx.org.id);
      if (!count) throw new ActionError("Add at least one line before opening bidding.");
    }
    if (to === "draft") {
      const { count } = await ctx.supabase
        .from("bid_preferences")
        .select("id", { count: "exact", head: true })
        .eq("cycle_id", id)
        .eq("organization_id", ctx.org.id);
      if (count) throw new ActionError("Employees have already bid on this cycle. Close bidding instead.");
    }
    const updated = check(
      await ctx.supabase
        .from("bid_cycles")
        .update({ status: to })
        .eq("id", id)
        .eq("organization_id", ctx.org.id)
        .eq("status", cycle.status)
        .select("id"),
    );
    if (!updated?.length) throw new ActionError("Someone else changed this cycle. Refresh and try again.");
    await audit(ctx, "bid_cycle.status", "bid_cycles", id, { from: cycle.status, to });
  },
);

export const deleteCycle = action({ schema: z.object({ id: zId }), capability: "bids" }, async ({ id }, ctx) => {
  const cycle = await loadCycle(ctx, id);
  if (cycle.status !== "draft") throw new ActionError("Only draft cycles can be deleted.");
  check(await ctx.supabase.from("bid_cycles").delete().eq("id", id).eq("organization_id", ctx.org.id));
  await audit(ctx, "bid_cycle.delete", "bid_cycles", id, { name: cycle.name });
});

// ---------------------------------------------------------------------------
// Lines (draft only)
// ---------------------------------------------------------------------------
const lineFields = z.object({
  cycle_id: zId,
  line_number: z.coerce.number().int().min(1, "Line numbers start at 1.").max(9999),
  start_time: zTime,
  end_time: zTime,
  report_time: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(zTime.nullable()),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, "Pick at least one day."),
  line_type: z.enum(["full_time", "part_time", "shuttle", "other"]),
  capacity: z.coerce.number().int().min(1, "Capacity is at least 1.").max(100),
  route_id: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(zId.nullable()),
  notes: zOptionalText(500),
});

async function draftCycle(ctx: AuthContext, cycleId: string) {
  const cycle = await loadCycle(ctx, cycleId);
  if (cycle.status !== "draft") throw new ActionError("Lines can only change while the cycle is a draft.");
  return cycle;
}

function lineRow(v: z.infer<typeof lineFields>) {
  return {
    line_number: v.line_number,
    start_time: v.start_time,
    end_time: v.end_time,
    report_time: v.report_time,
    weekdays: [...new Set(v.weekdays)].sort((a, b) => a - b),
    line_type: v.line_type,
    capacity: v.capacity,
    route_id: v.route_id,
    notes: v.notes,
  };
}

function duplicateLine(err: unknown): never {
  if ((err as { code?: string })?.code === "23505") throw new ActionError("That line number is already used in this cycle.");
  throw err;
}

export const saveLine = action(
  { schema: lineFields.extend({ id: zId.optional() }), capability: "bids" },
  async (v, ctx) => {
    await draftCycle(ctx, v.cycle_id);
    if (v.id) {
      const res = await ctx.supabase
        .from("bid_lines")
        .update(lineRow(v))
        .eq("id", v.id)
        .eq("cycle_id", v.cycle_id)
        .eq("organization_id", ctx.org.id);
      if (res.error) duplicateLine(res.error);
    } else {
      const res = await ctx.supabase
        .from("bid_lines")
        .insert({ ...lineRow(v), organization_id: ctx.org.id, cycle_id: v.cycle_id });
      if (res.error) duplicateLine(res.error);
    }
  },
);

export const deleteLine = action(
  { schema: z.object({ id: zId, cycle_id: zId }), capability: "bids" },
  async ({ id, cycle_id }, ctx) => {
    await draftCycle(ctx, cycle_id);
    check(
      await ctx.supabase.from("bid_lines").delete().eq("id", id).eq("cycle_id", cycle_id).eq("organization_id", ctx.org.id),
    );
  },
);

// ---------------------------------------------------------------------------
// Awards
// ---------------------------------------------------------------------------
const awardSchema = z.object({
  cycle_id: zId,
  awards: z
    .array(
      z.object({
        employee_id: zId,
        line_id: zId,
        choice_rank: z.number().int().min(1).max(10).nullable(),
        method: z.enum(["seniority", "auto", "manual"]),
        reason: z.string().trim().max(500).nullable(),
      }),
    )
    .max(5000),
});

export const applyAwards = action({ schema: awardSchema, capability: "bids" }, async ({ cycle_id, awards }, ctx) => {
  const ids = new Set(awards.map((a) => a.employee_id));
  if (ids.size !== awards.length) throw new ActionError("Each employee can be awarded only one line.");
  for (const a of awards) {
    if (a.method === "manual" && !a.reason) throw new ActionError("Give a reason for every manual award.");
  }
  const cycle = await loadCycle(ctx, cycle_id);
  if (cycle.status !== "closed" && cycle.status !== "awarded") throw new ActionError("Close bidding before awarding.");
  const n = check(await ctx.supabase.rpc("apply_bid_awards", { p_cycle_id: cycle_id, p_awards: awards }));
  await audit(ctx, "bid_cycle.award", "bid_cycles", cycle_id, {
    awards: awards.length,
    manual: awards.filter((a) => a.method === "manual").length,
  });
  return { count: n };
});
