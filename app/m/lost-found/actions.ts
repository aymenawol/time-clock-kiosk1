"use server";

import { z } from "zod";
import { action, ActionError, zId } from "@/lib/actions";

const LOST_CATEGORIES = ["bag", "electronics", "document", "clothing", "jewelry", "other"] as const;

export const reportLostItem = action(
  {
    schema: z.object({
      itemId: zId,
      description: z.string().trim().min(1, "Describe the item").max(500),
      category: z.enum(LOST_CATEGORIES),
      contents: z.string().trim().max(2000).optional(),
      locationId: zId.nullable().optional(),
      vehicleId: zId.nullable().optional(),
      photoPaths: z.array(z.string().max(300)).max(6),
    }),
    capability: "field",
  },
  async (v, ctx) => {
    // Photos must live under this organization and item, as uploaded by the client.
    const prefix = `${ctx.org.id}/${v.itemId}/`;
    if (v.photoPaths.some((p) => !p.startsWith(prefix) || p.includes(".."))) throw new ActionError("A photo path is not valid.");
    const { data, error } = await ctx.supabase
      .from("lost_items")
      .insert({
        id: v.itemId,
        organization_id: ctx.org.id,
        description: v.description,
        category: v.category,
        contents: v.contents ? v.contents : null,
        found_location_id: v.locationId ?? null,
        found_vehicle_id: v.vehicleId ?? null,
        found_by: ctx.employee.id,
        status: "found",
        photo_paths: v.photoPaths,
      })
      .select("reference")
      .single();
    if (error) throw error;
    return { reference: data.reference };
  },
);
