"use server";

import { z } from "zod";
import { statusAfterService } from "@/components/field/rules";
import { action, ActionError, check, zId, zOptionalText } from "@/lib/actions";
import type { TablesUpdate } from "@/lib/supabase/types";

const schema = z.object({
  vehicleId: zId,
  service: z.enum(["fuel", "wash", "charge"]),
  energyAfter: z.number().int().min(0, "Level is 0 to 100").max(100, "Level is 0 to 100").nullable(),
  quantity: z.number().min(0, "Quantity can't be negative").max(5000, "That quantity looks too high").nullable(),
  odometer: z.number().int().min(0).max(9_999_999, "That odometer reading looks too high").nullable(),
  notes: zOptionalText(1000),
});

/** Log a fuel, wash or charge and move the vehicle along the fueler state machine. */
export const logService = action({ schema, capability: "fuelQueue" }, async (input, ctx) => {
  const v = check(
    await ctx.supabase
      .from("vehicles")
      .select("id, number, status, powertrain, energy_level, odometer, active")
      .eq("id", input.vehicleId)
      .eq("organization_id", ctx.org.id)
      .maybeSingle(),
  );
  if (!v || !v.active) throw new ActionError("That vehicle was not found. Refresh and try again.");
  if (input.service === "fuel" && v.powertrain === "ev") throw new ActionError("Electric vehicles are charged, not fueled.");
  if (input.service === "charge" && v.powertrain !== "ev" && v.powertrain !== "hybrid") {
    throw new ActionError(`Vehicle ${v.number} can't be charged. Log fuel instead.`);
  }
  if (input.odometer !== null && v.odometer !== null && input.odometer < v.odometer) {
    throw new ActionError(`The odometer can't be lower than the last reading (${v.odometer.toLocaleString("en-US")}).`);
  }
  const energyAfter = input.service === "wash" ? null : input.energyAfter;

  check(
    await ctx.supabase.from("fuel_logs").insert({
      organization_id: ctx.org.id,
      vehicle_id: v.id,
      employee_id: ctx.employee.id,
      service: input.service,
      energy_before: v.energy_level,
      energy_after: energyAfter,
      quantity: input.service === "wash" ? null : input.quantity,
      odometer: input.odometer,
      notes: input.notes,
    }),
  );

  const next = statusAfterService(input.service, v.status);
  const patch: TablesUpdate<"vehicles"> = {};
  if (next !== v.status) patch.status = next;
  if (energyAfter !== null) patch.energy_level = energyAfter;
  if (input.odometer !== null) patch.odometer = input.odometer;
  if (Object.keys(patch).length) {
    check(await ctx.supabase.from("vehicles").update(patch).eq("id", v.id).eq("organization_id", ctx.org.id));
  }
  return { number: v.number, status: next };
});
