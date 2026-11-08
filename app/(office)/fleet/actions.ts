"use server";

import { z } from "zod";
import { must } from "@/components/records/must";
import { action, ActionError, audit, check, zId } from "@/lib/actions";

const POWERTRAINS = ["diesel", "ev", "gasoline", "cng", "hybrid"] as const;
const STATUSES = [
  "ready",
  "in_service",
  "charging",
  "needs_fuel",
  "needs_wash",
  "needs_fuel_wash",
  "pmi",
  "shop",
  "repair",
  "safety_hold",
  "training",
] as const;

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));
const optInt = (min: number, max: number) => z.number().int().min(min).max(max).nullish().transform((v) => v ?? null);

const vehicleFields = {
  number: z.string().trim().min(1, "Enter the vehicle number").max(20),
  vehicle_type: z.string().trim().min(1, "Enter a vehicle type").max(40),
  powertrain: z.enum(POWERTRAINS),
  capacity: optInt(1, 200),
  vin: z
    .string()
    .trim()
    .toUpperCase()
    .nullish()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[A-HJ-NPR-Z0-9]{17}$/.test(v), "A VIN has 17 characters (no I, O or Q)"),
  plate: optText(20),
  energy_level: optInt(0, 100),
  odometer: optInt(0, 5_000_000),
  notes: optText(2000),
};

export const createVehicle = action(
  { schema: z.object(vehicleFields), capability: "fleetEdit" },
  async (input, ctx) => {
    const row = must(
      check(
        await ctx.supabase
          .from("vehicles")
          .insert({ ...input, organization_id: ctx.org.id })
          .select("id")
          .single(),
      ),
    );
    await audit(ctx, "vehicle.create", "vehicles", row.id, { number: input.number });
    return { id: row.id };
  },
);

export const updateVehicle = action(
  { schema: z.object({ id: zId, ...vehicleFields }), capability: "fleetEdit" },
  async ({ id, ...input }, ctx) => {
    check(await ctx.supabase.from("vehicles").update(input).eq("id", id).eq("organization_id", ctx.org.id));
    await audit(ctx, "vehicle.update", "vehicles", id, { number: input.number });
  },
);

export const changeVehicleStatus = action(
  {
    schema: z.object({
      id: zId,
      status: z.enum(STATUSES),
      reason: z.string().trim().min(3, "Give a reason (at least 3 characters)").max(500),
    }),
    capability: "vehicleStatus",
  },
  async ({ id, status, reason }, ctx) => {
    const current = must(
      check(await ctx.supabase.from("vehicles").select("status").eq("id", id).eq("organization_id", ctx.org.id).single()),
    );
    if (current.status === "retired") throw new ActionError("This vehicle is retired. An admin can edit it from its page.");
    if (current.status === status) throw new ActionError("The vehicle already has that status.");
    check(await ctx.supabase.rpc("set_vehicle_status", { p_vehicle_id: id, p_status: status, p_reason: reason }));
  },
);

export const retireVehicle = action(
  { schema: z.object({ id: zId, reason: z.string().trim().min(3, "Give a reason").max(500) }), capability: "fleetEdit" },
  async ({ id, reason }, ctx) => {
    check(
      await ctx.supabase
        .from("vehicles")
        .update({ status: "retired", active: false })
        .eq("id", id)
        .eq("organization_id", ctx.org.id),
    );
    await audit(ctx, "vehicle.retire", "vehicles", id, { reason });
  },
);
