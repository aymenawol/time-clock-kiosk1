"use server";

import { z } from "zod";
import { SHOP_STATUSES } from "@/components/field/rules";
import { action, ActionError, audit, check, zId, zOptionalText } from "@/lib/actions";
import type { AuthContext } from "@/lib/auth/session";

const WORKABLE = ["open", "in_progress", "deferred"];
const MAX_PHOTOS = 12;

async function loadDefect(ctx: AuthContext, id: string) {
  const d = check(
    await ctx.supabase
      .from("defects")
      .select("id, vehicle_id, status, severity, item, photo_paths")
      .eq("id", id)
      .eq("organization_id", ctx.org.id)
      .maybeSingle(),
  );
  if (!d) throw new ActionError("That defect was not found. Refresh and try again.");
  return d;
}

/**
 * Put the vehicle back to ready when nothing serious is still open on it.
 * Returns why it stayed out of service, or null when it was released.
 */
async function releaseVehicle(ctx: AuthContext, vehicleId: string, exceptDefectId: string): Promise<string | null> {
  const { count, error } = await ctx.supabase
    .from("defects")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.org.id)
    .eq("vehicle_id", vehicleId)
    .neq("id", exceptDefectId)
    .in("status", ["open", "in_progress"])
    .in("severity", ["critical", "major"]);
  if (error) throw error;
  if (count) return `${count} other critical or major defect${count === 1 ? " is" : "s are"} still open, so the vehicle stays out of service.`;

  const v = check(
    await ctx.supabase
      .from("vehicles")
      .select("id, number, status")
      .eq("id", vehicleId)
      .eq("organization_id", ctx.org.id)
      .maybeSingle(),
  );
  if (!v) return "The vehicle was not found.";
  if (!SHOP_STATUSES.includes(v.status)) return null;
  check(await ctx.supabase.from("vehicles").update({ status: "ready" }).eq("id", v.id).eq("organization_id", ctx.org.id));
  await audit(ctx, "vehicle.release", "vehicles", v.id, { from: v.status, defect_id: exceptDefectId });
  return null;
}

export const startWork = action({ schema: z.object({ id: zId }), capability: "defectQueue" }, async ({ id }, ctx) => {
  const d = await loadDefect(ctx, id);
  if (!WORKABLE.includes(d.status)) throw new ActionError("This defect is already resolved.");
  check(
    await ctx.supabase
      .from("defects")
      .update({ status: "in_progress", assigned_to: ctx.employee.id })
      .eq("id", id)
      .eq("organization_id", ctx.org.id),
  );
});

export const addDefectPhoto = action(
  { schema: z.object({ id: zId, path: z.string().min(10).max(300) }), capability: "defectQueue" },
  async ({ id, path }, ctx) => {
    const prefix = `${ctx.org.id}/${id}/`;
    const name = path.slice(prefix.length);
    if (!path.startsWith(prefix) || !/^[0-9a-f-]{36}\.(jpe?g|png|webp|heic)$/i.test(name)) {
      throw new ActionError("That photo could not be attached. Try uploading it again.");
    }
    const d = await loadDefect(ctx, id);
    if (d.photo_paths.includes(path)) return;
    if (d.photo_paths.length >= MAX_PHOTOS) throw new ActionError(`A defect can have up to ${MAX_PHOTOS} photos.`);
    check(
      await ctx.supabase
        .from("defects")
        .update({ photo_paths: [...d.photo_paths, path] })
        .eq("id", id)
        .eq("organization_id", ctx.org.id),
    );
  },
);

const closeSchema = z.object({
  id: zId,
  note: z.string().trim().min(3, "Write a short note (at least 3 characters).").max(2000),
  releaseVehicle: z.boolean().default(false),
});

export const resolveDefect = action({ schema: closeSchema, capability: "defectQueue" }, async (input, ctx) => {
  const d = await loadDefect(ctx, input.id);
  if (!WORKABLE.includes(d.status)) throw new ActionError("This defect is already resolved.");
  check(
    await ctx.supabase
      .from("defects")
      .update({
        status: "resolved",
        resolution_note: input.note,
        resolved_by: ctx.employee.id,
        resolved_at: new Date().toISOString(),
        assigned_to: ctx.employee.id,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.org.id),
  );
  const kept = input.releaseVehicle ? await releaseVehicle(ctx, d.vehicle_id, d.id) : null;
  return { kept };
});

export const deferDefect = action({ schema: closeSchema, capability: "defectQueue" }, async (input, ctx) => {
  const d = await loadDefect(ctx, input.id);
  if (d.status !== "open" && d.status !== "in_progress") throw new ActionError("Only open defects can be deferred.");
  if (d.severity === "critical") {
    throw new ActionError("Critical defects can't be deferred. Fix it, or leave it open so the vehicle stays out of service.");
  }
  check(
    await ctx.supabase
      .from("defects")
      .update({ status: "deferred", resolution_note: input.note })
      .eq("id", input.id)
      .eq("organization_id", ctx.org.id),
  );
  const kept = input.releaseVehicle ? await releaseVehicle(ctx, d.vehicle_id, d.id) : null;
  return { kept };
});

export const reportDefect = action(
  {
    schema: z.object({
      vehicleId: zId,
      category: z.string().trim().min(1, "Choose a category.").max(60),
      item: z.string().trim().min(2, "Say what is broken.").max(120),
      description: zOptionalText(2000),
      severity: z.enum(["minor", "major", "critical"]),
      toShop: z.boolean().default(false),
    }),
    capability: "defectQueue",
  },
  async (input, ctx) => {
    const v = check(
      await ctx.supabase
        .from("vehicles")
        .select("id, number, status")
        .eq("id", input.vehicleId)
        .eq("organization_id", ctx.org.id)
        .eq("active", true)
        .maybeSingle(),
    );
    if (!v) throw new ActionError("That vehicle was not found.");
    const row = check(
      await ctx.supabase
        .from("defects")
        .insert({
          organization_id: ctx.org.id,
          vehicle_id: v.id,
          reported_by: ctx.employee.id,
          category: input.category,
          item: input.item,
          description: input.description,
          severity: input.severity,
        })
        .select("id")
        .single(),
    );
    let shopped = false;
    if (input.toShop && !SHOP_STATUSES.includes(v.status)) {
      check(await ctx.supabase.from("vehicles").update({ status: "shop" }).eq("id", v.id).eq("organization_id", ctx.org.id));
      await audit(ctx, "vehicle.shop", "vehicles", v.id, { from: v.status, defect_id: row?.id ?? null });
      shopped = true;
    }
    return { number: v.number, shopped };
  },
);
