"use server";

import { z } from "zod";
import { action, ActionError, check, zId } from "@/lib/actions";

/** 10-51 request: the same three fields v0 asked for, plus the vehicle and shift from the clock-in. */
export const createAssist = action(
  {
    schema: z.object({
      passengerName: z.string().trim().min(1, "Enter the passenger's name.").max(120, "Keep the name under 120 characters."),
      airlineId: zId,
      flightNumber: z.string().trim().min(1, "Enter the flight number.").max(12, "Flight numbers are at most 12 characters."),
    }),
    capability: "driving",
  },
  async ({ passengerName, airlineId, flightNumber }, ctx) => {
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

    const airline = check(
      await ctx.supabase
        .from("airlines")
        .select("id, location_id")
        .eq("organization_id", ctx.org.id)
        .eq("active", true)
        .eq("id", airlineId)
        .maybeSingle(),
    );
    if (!airline) throw new ActionError("That airline is no longer available. Pick another.");

    check(
      await ctx.supabase.from("assist_requests").insert({
        organization_id: ctx.org.id,
        employee_id: ctx.employee.id,
        shift_id: shift.id,
        vehicle_id: shift.vehicle_id,
        airline_id: airline.id,
        location_id: airline.location_id,
        passenger_name: passengerName,
        flight_number: flightNumber.toUpperCase(),
      }),
    );
  },
);

export const cancelAssist = action({ schema: z.object({ id: zId }), capability: "driving" }, async ({ id }, ctx) => {
  const rows = check(
    await ctx.supabase
      .from("assist_requests")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("organization_id", ctx.org.id)
      .eq("employee_id", ctx.employee.id)
      .in("status", ["pending", "escalated"])
      .select("id"),
  );
  if (!rows?.length) throw new ActionError("This request can't be cancelled any more. Dispatch has already picked it up.");
});
