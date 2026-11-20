"use server";

import { z } from "zod";
import { must } from "@/components/records/must";
import { action, ActionError, audit, check, zId } from "@/lib/actions";
import { resolveSlotStart, timeInputValue } from "@/lib/counts/sheet";

/** Record or clear a meal-break waiver (NRS 608.019) on a shift. Waived meals stay paid. */
export const setMealWaived = action(
  { schema: z.object({ shiftId: zId, waived: z.boolean() }), capability: "mealWaiverEdit" },
  async ({ shiftId, waived }, ctx) => {
    check(
      await ctx.supabase
        .from("shifts")
        .update({ meal_waived: waived })
        .eq("id", shiftId)
        .eq("organization_id", ctx.org.id),
    );
    await audit(ctx, "shift.meal_waiver", "shifts", shiftId, { meal_waived: waived });
  },
);

/**
 * Dispatch sets a driver's planned rest-break slot (the paper's BRK Windows).
 * The time is a wall-clock "HH:mm" in the organization time zone during the
 * shift; the set_break_slot RPC keeps the window length and refuses breaks
 * that have started.
 */
export const setBreakSlot = action(
  {
    schema: z.object({ breakId: zId, time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:45") }),
    capability: "breakSlotEdit",
  },
  async ({ breakId, time }, ctx) => {
    const b = must(
      check(
        await ctx.supabase
          .from("breaks")
          .select("id, shift_id, window_start, kind")
          .eq("id", breakId)
          .eq("organization_id", ctx.org.id)
          .single(),
      ),
    );
    if (b.kind !== "rest") throw new ActionError("Only rest break slots can be set here.");
    const shift = must(
      check(await ctx.supabase.from("shifts").select("clock_in_at").eq("id", b.shift_id).eq("organization_id", ctx.org.id).single()),
    );
    const start = resolveSlotStart(shift.clock_in_at, time, ctx.org.timezone);
    check(await ctx.supabase.rpc("set_break_slot", { p_break_id: breakId, p_start: start.toISOString() }));
    await audit(ctx, "break.slot_set", "breaks", breakId, {
      shift_id: b.shift_id,
      from: b.window_start ? timeInputValue(b.window_start, ctx.org.timezone) : null,
      to: time,
    });
  },
);
