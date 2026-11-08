"use server";

import { z } from "zod";
import { action, check, zOptionalText } from "@/lib/actions";

export const submitEndShift = action(
  {
    schema: z.object({
      energyLevel: z.number().int().min(0, "Battery can't be below 0%.").max(100, "Battery can't be above 100%.").nullable(),
      condition: z.enum(["ready", "needs_charge", "needs_fuel", "shop", "hazard"]),
      odometer: z.number().int().min(0).max(9_999_999, "That odometer reading looks too high").nullable(),
      notes: zOptionalText(2000),
    }),
    capability: "driving",
  },
  async ({ energyLevel, condition, odometer, notes }, ctx) => {
    const res = check(
      await ctx.supabase.rpc("submit_end_of_shift", {
        p_energy_level: energyLevel as number,
        p_condition: condition,
        p_odometer: odometer as number,
        p_notes: notes as string,
      }),
    ) as { vehicle_status: string } | null;
    return { vehicleStatus: res?.vehicle_status ?? null };
  },
);
