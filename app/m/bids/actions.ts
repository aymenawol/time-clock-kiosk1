"use server";

import { z } from "zod";
import { action, check, zId } from "@/lib/actions";

export const submitBids = action(
  { schema: z.object({ cycleId: zId, lineIds: z.array(zId).min(1, "Pick at least one line").max(10) }), capability: "field" },
  async ({ cycleId, lineIds }, ctx) => {
    check(await ctx.supabase.rpc("submit_bid_preferences", { p_cycle_id: cycleId, p_line_ids: lineIds }));
  },
);
