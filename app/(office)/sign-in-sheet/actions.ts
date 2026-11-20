"use server";

import { z } from "zod";
import { action, audit, check, zId } from "@/lib/actions";

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
