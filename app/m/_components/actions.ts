"use server";

import { z } from "zod";
import { action, check } from "@/lib/actions";

/** Start a rest or meal break on the caller's active shift (RPC validates). */
export const startBreak = action(
  { schema: z.object({ kind: z.enum(["rest", "meal"]) }), capability: "shiftCard" },
  async ({ kind }, ctx) => {
    check(await ctx.supabase.rpc("start_break", { p_kind: kind }));
  },
);

export const endBreak = action({ schema: z.object({}), capability: "shiftCard" }, async (_input, ctx) => {
  check(await ctx.supabase.rpc("end_break"));
});

/** Set the driver's radio status; the RPC may change the vehicle status and notify dispatch. */
export const setRadioStatus = action(
  { schema: z.object({ code: z.string().trim().min(1).max(12) }), capability: "driving" },
  async ({ code }, ctx) => {
    const res = check(await ctx.supabase.rpc("set_radio_status", { p_code: code }));
    return res as { code: string; label: string; vehicle_status: string | null };
  },
);
