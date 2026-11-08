"use server";

import { z } from "zod";
import { action, ActionError, audit, check, zId } from "@/lib/actions";
import { fromZonedInput } from "@/components/ops/time";

const ASSIGNABLE_VEHICLE_STATUSES = ["ready", "in_service"];

const zOptionalId = z
  .union([zId, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));
const zLocalDateTime = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Enter a valid date and time"), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

/** Assign vehicle, tablet, route and scheduled times to a shift (dispatch). */
export const assignShift = action(
  {
    schema: z.object({
      shiftId: zId,
      vehicleId: zOptionalId,
      tabletId: zOptionalId,
      routeId: zOptionalId,
      scheduledStart: zLocalDateTime,
      scheduledEnd: zLocalDateTime,
    }),
    capability: "signInSheetAssign",
  },
  async (input, ctx) => {
    const tz = ctx.org.timezone;
    const start = input.scheduledStart ? fromZonedInput(input.scheduledStart, tz) : null;
    const end = input.scheduledEnd ? fromZonedInput(input.scheduledEnd, tz) : null;
    if (start && end && end <= start) throw new ActionError("The scheduled end must be after the start.");

    const shift = check(
      await ctx.supabase
        .from("shifts")
        .select("id, status, vehicle_id, tablet_id")
        .eq("id", input.shiftId)
        .eq("organization_id", ctx.org.id)
        .maybeSingle(),
    );
    if (!shift) throw new ActionError("That shift no longer exists. Refresh the page.");
    if (shift.status === "void") throw new ActionError("This shift was voided and can't be changed.");

    if (input.vehicleId && input.vehicleId !== shift.vehicle_id && shift.status === "active") {
      const vehicle = check(
        await ctx.supabase
          .from("vehicles")
          .select("number, status, active")
          .eq("id", input.vehicleId)
          .eq("organization_id", ctx.org.id)
          .maybeSingle(),
      );
      if (!vehicle || !vehicle.active) throw new ActionError("That vehicle is not in the fleet any more.");
      if (!ASSIGNABLE_VEHICLE_STATUSES.includes(vehicle.status)) {
        throw new ActionError(`Vehicle ${vehicle.number} is not ready for service. Pick a ready vehicle.`);
      }
    }

    const { error } = await ctx.supabase
      .from("shifts")
      .update({
        vehicle_id: input.vehicleId,
        tablet_id: input.tabletId,
        route_id: input.routeId,
        scheduled_start: start?.toISOString() ?? null,
        scheduled_end: end?.toISOString() ?? null,
      })
      .eq("id", input.shiftId)
      .eq("organization_id", ctx.org.id);
    if (error) {
      if (error.code === "23505") {
        if (error.message.includes("vehicle")) throw new ActionError("That vehicle is already on another active shift. Pick another one.");
        if (error.message.includes("tablet")) throw new ActionError("That tablet is already on another active shift. Pick another one.");
      }
      throw error;
    }
    await audit(ctx, "shift.assign", "shifts", input.shiftId, {
      vehicle_id: input.vehicleId,
      tablet_id: input.tabletId,
      route_id: input.routeId,
      scheduled_start: start?.toISOString() ?? null,
      scheduled_end: end?.toISOString() ?? null,
    });
  },
);

/** Re-open a missed break with a fresh window (RPC checks role and state). */
export const reopenBreak = action({ schema: z.object({ breakId: zId }), capability: "breakReopen" }, async ({ breakId }, ctx) => {
  check(await ctx.supabase.rpc("reopen_break", { p_break_id: breakId }));
  await audit(ctx, "break.reopen", "breaks", breakId);
});

/** Create or edit the overtime banner. Only one overtime banner is active at a time. */
export const saveOvertimeBanner = action(
  {
    schema: z.object({
      id: zId.optional(),
      message: z.string().trim().min(1, "Write the banner message").max(500, "Keep it under 500 characters"),
      active: z.boolean(),
    }),
    capability: "overtime",
  },
  async ({ id, message, active }, ctx) => {
    if (active) {
      let q = ctx.supabase
        .from("announcements")
        .update({ active: false })
        .eq("organization_id", ctx.org.id)
        .eq("kind", "overtime")
        .eq("active", true);
      if (id) q = q.neq("id", id);
      check(await q);
    }
    if (id) {
      check(
        await ctx.supabase
          .from("announcements")
          .update({ message, active })
          .eq("id", id)
          .eq("organization_id", ctx.org.id)
          .eq("kind", "overtime"),
      );
    } else {
      check(
        await ctx.supabase
          .from("announcements")
          .insert({ organization_id: ctx.org.id, kind: "overtime", message, active, created_by: ctx.employee.id }),
      );
    }
    await audit(ctx, id ? "announcement.update" : "announcement.create", "announcements", id ?? null, { active });
  },
);

export const setOvertimeBannerActive = action(
  { schema: z.object({ id: zId, active: z.boolean() }), capability: "overtime" },
  async ({ id, active }, ctx) => {
    if (active) {
      check(
        await ctx.supabase
          .from("announcements")
          .update({ active: false })
          .eq("organization_id", ctx.org.id)
          .eq("kind", "overtime")
          .eq("active", true)
          .neq("id", id),
      );
    }
    check(
      await ctx.supabase
        .from("announcements")
        .update({ active })
        .eq("id", id)
        .eq("organization_id", ctx.org.id)
        .eq("kind", "overtime"),
    );
    await audit(ctx, active ? "announcement.activate" : "announcement.deactivate", "announcements", id);
  },
);
