"use server";

import { z } from "zod";
import { action, ActionError, check, zId } from "@/lib/actions";

export const bidOnOffer = action({ schema: z.object({ offerId: zId }), capability: "field" }, async ({ offerId }, ctx) => {
  const { error } = await ctx.supabase
    .from("ot_bids")
    .insert({ organization_id: ctx.org.id, offer_id: offerId, employee_id: ctx.employee.id });
  if (error) {
    if (error.code === "23505") return;
    if (error.code === "42501") throw new ActionError("Bidding is closed or this offer is not open to your role.");
    throw error;
  }
});

export const withdrawOfferBid = action({ schema: z.object({ offerId: zId }), capability: "field" }, async ({ offerId }, ctx) => {
  check(
    await ctx.supabase
      .from("ot_bids")
      .delete()
      .eq("offer_id", offerId)
      .eq("employee_id", ctx.employee.id)
      .eq("organization_id", ctx.org.id),
  );
});

export const respondOffDay = action(
  {
    schema: z
      .object({
        id: zId,
        response: z.enum(["accepted", "declined", "partial"]),
        availableFrom: z.string().regex(/^\d{2}:\d{2}$/, "Enter a start time").optional(),
        availableHours: z.coerce.number().positive("Enter the hours").max(16, "Up to 16 hours").optional(),
        note: z.string().trim().max(500).optional(),
      })
      .refine((v) => v.response !== "partial" || (v.availableFrom && v.availableHours), {
        message: "Enter when you can start and for how many hours",
        path: ["availableFrom"],
      }),
    capability: "field",
  },
  async (v, ctx) => {
    const rows = check(
      await ctx.supabase
        .from("off_day_requests")
        .update({
          response: v.response,
          available_from: v.response === "partial" ? v.availableFrom : null,
          available_hours: v.response === "partial" ? v.availableHours : null,
          response_note: v.note ? v.note : null,
          responded_at: new Date().toISOString(),
        })
        .eq("id", v.id)
        .eq("employee_id", ctx.employee.id)
        .eq("organization_id", ctx.org.id)
        .eq("response", "pending")
        .select("id"),
    );
    if ((rows ?? []).length === 0) throw new ActionError("This request was already answered.");
  },
);
