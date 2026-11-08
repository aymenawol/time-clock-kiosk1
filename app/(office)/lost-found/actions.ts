"use server";

import { z } from "zod";
import { must } from "@/components/records/must";
import type { TablesUpdate } from "@/lib/supabase/types";
import { action, ActionError, check, zId } from "@/lib/actions";

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const logLostItem = action(
  {
    schema: z.object({
      description: z.string().trim().min(2, "Describe the item").max(500),
      category: z.enum(["bag", "electronics", "document", "clothing", "jewelry", "other"]),
      contents: optText(2000),
      found_location_id: zId.nullish().transform((v) => v ?? null),
      found_vehicle_id: zId.nullish().transform((v) => v ?? null),
    }),
    capability: "lostFound",
  },
  async (input, ctx) => {
    const row = must(
      check(
        await ctx.supabase
          .from("lost_items")
          .insert({ ...input, organization_id: ctx.org.id, found_by: ctx.employee.id, status: "found" })
          .select("reference")
          .single(),
      ),
    );
    return { reference: row.reference };
  },
);

const FLOW: Record<string, string[]> = {
  found: ["collected", "at_dispatch", "claimed", "disposed"],
  collected: ["at_dispatch", "claimed", "disposed"],
  at_dispatch: ["claimed", "disposed"],
};

export const transitionLostItem = action(
  {
    schema: z.object({
      id: zId,
      to: z.enum(["collected", "at_dispatch", "claimed", "disposed"]),
      claimant_name: optText(120),
      claimant_contact: optText(120),
      claimant_id_last4: z
        .string()
        .trim()
        .nullish()
        .transform((v) => (v ? v : null))
        .refine((v) => v === null || /^[A-Za-z0-9]{1,4}$/.test(v), "Enter up to 4 letters or digits"),
      disposal_reason: optText(500),
    }),
    capability: "lostFound",
  },
  async (input, ctx) => {
    const item = must(
      check(await ctx.supabase.from("lost_items").select("status").eq("id", input.id).eq("organization_id", ctx.org.id).single()),
    );
    if (!(FLOW[item.status] ?? []).includes(input.to)) {
      throw new ActionError("That item can't move to that status from where it is now.");
    }
    const patch: TablesUpdate<"lost_items"> = { status: input.to };
    if (input.to === "collected") patch.custody_by = ctx.employee.id;
    if (input.to === "claimed") {
      if (!input.claimant_name) throw new ActionError("Enter the name of the person claiming the item.");
      patch.claimant_name = input.claimant_name;
      patch.claimant_contact = input.claimant_contact;
      patch.claimant_id_last4 = input.claimant_id_last4;
    }
    if (input.to === "disposed") {
      if (!input.disposal_reason) throw new ActionError("Enter why the item is being disposed of.");
      patch.disposal_reason = input.disposal_reason;
    }
    check(await ctx.supabase.from("lost_items").update(patch).eq("id", input.id).eq("organization_id", ctx.org.id));
  },
);
