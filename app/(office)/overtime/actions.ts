"use server";

import { z } from "zod";
import { action, ActionError, audit, check, zId } from "@/lib/actions";
import { ROLES } from "@/lib/auth/permissions";
import { fromZonedInput, isLocalInput, YMD } from "@/lib/scheduling/datetime";

const zLocal = z.string().refine(isLocalInput, "Enter a date and time.");

export const postOffer = action(
  {
    schema: z
      .object({
        starts_at: zLocal,
        duration_minutes: z.coerce
          .number()
          .int()
          .min(15, "Overtime is at least 15 minutes.")
          .max(960, "Overtime can be at most 16 hours."),
        slots: z.coerce.number().int().min(1, "Offer at least 1 slot.").max(100),
        description: z.string().trim().min(3, "Describe the work (at least 3 characters).").max(2000),
        bid_closes_at: zLocal,
        eligible_roles: z.array(z.enum(ROLES)).min(1, "Pick at least one role."),
      })
      .refine((v) => v.bid_closes_at <= v.starts_at, {
        path: ["bid_closes_at"],
        message: "Bidding must close before the overtime starts.",
      }),
    capability: "overtime",
  },
  async (v, ctx) => {
    const startsAt = fromZonedInput(v.starts_at, ctx.org.timezone);
    const closesAt = fromZonedInput(v.bid_closes_at, ctx.org.timezone);
    if (closesAt.getTime() < Date.now() - 60_000) throw new ActionError("Bidding must close in the future.");
    const row = check(
      await ctx.supabase
        .from("ot_offers")
        .insert({
          organization_id: ctx.org.id,
          starts_at: startsAt.toISOString(),
          duration_minutes: v.duration_minutes,
          slots: v.slots,
          description: v.description,
          bid_closes_at: closesAt.toISOString(),
          eligible_roles: [...new Set(v.eligible_roles)],
          posted_by: ctx.employee.id,
        })
        .select("id")
        .single(),
    );
    if (!row) throw new ActionError("The offer was not posted. Try again.");
    await audit(ctx, "ot_offer.post", "ot_offers", row.id, { slots: v.slots, duration: v.duration_minutes });
    return { id: row.id };
  },
);

const OFFER_TRANSITIONS: Record<string, string[]> = {
  open: ["closed", "cancelled"],
  closed: ["open", "cancelled"],
  awarded: [],
  cancelled: [],
};

export const setOfferStatus = action(
  { schema: z.object({ id: zId, to: z.enum(["open", "closed", "cancelled"]) }), capability: "overtime" },
  async ({ id, to }, ctx) => {
    const offer = check(
      await ctx.supabase.from("ot_offers").select("id, status").eq("id", id).eq("organization_id", ctx.org.id).maybeSingle(),
    );
    if (!offer) throw new ActionError("That offer no longer exists.");
    if (!OFFER_TRANSITIONS[offer.status]?.includes(to)) {
      throw new ActionError(`An ${offer.status} offer can't be ${to === "open" ? "reopened" : to}.`);
    }
    const updated = check(
      await ctx.supabase
        .from("ot_offers")
        .update({ status: to })
        .eq("id", id)
        .eq("organization_id", ctx.org.id)
        .eq("status", offer.status)
        .select("id"),
    );
    if (!updated?.length) throw new ActionError("Someone else changed this offer. Refresh and try again.");
    await audit(ctx, "ot_offer.status", "ot_offers", id, { from: offer.status, to });
  },
);

export const awardOffer = action(
  {
    schema: z.object({
      offer_id: zId,
      employee_ids: z.array(zId).min(1, "Pick at least one employee.").max(100),
      method: z.enum(["seniority", "manual"]),
    }),
    capability: "overtime",
  },
  async ({ offer_id, employee_ids, method }, ctx) => {
    const ids = [...new Set(employee_ids)];
    const n = check(
      await ctx.supabase.rpc("award_ot_offer", { p_offer_id: offer_id, p_employee_ids: ids, p_method: method }),
    );
    await audit(ctx, "ot_offer.award", "ot_offers", offer_id, { employees: ids, method });
    return { count: n ?? ids.length };
  },
);

export const saveBanner = action(
  {
    schema: z.object({
      message: z.string().trim().min(1, "Write the banner message.").max(500, "Keep it under 500 characters."),
      active: z.boolean(),
    }),
    capability: "overtime",
  },
  async ({ message, active }, ctx) => {
    const existing = check(
      await ctx.supabase
        .from("announcements")
        .select("id")
        .eq("organization_id", ctx.org.id)
        .eq("kind", "overtime")
        .order("updated_at", { ascending: false })
        .limit(1),
    );
    const id = existing?.[0]?.id;
    if (id) {
      check(
        await ctx.supabase.from("announcements").update({ message, active }).eq("id", id).eq("organization_id", ctx.org.id),
      );
    } else {
      check(
        await ctx.supabase
          .from("announcements")
          .insert({ organization_id: ctx.org.id, kind: "overtime", message, active, created_by: ctx.employee.id }),
      );
    }
    await audit(ctx, "ot_banner.save", "announcements", id ?? null, { active });
  },
);

export const sendOffDayRequest = action(
  {
    schema: z.object({
      employee_id: zId,
      work_date: z.string().regex(YMD, "Pick a date."),
      message: z.string().trim().min(1, "Write a message.").max(1000),
    }),
    capability: "overtime",
  },
  async (v, ctx) => {
    const emp = check(
      await ctx.supabase
        .from("employees")
        .select("id, status")
        .eq("id", v.employee_id)
        .eq("organization_id", ctx.org.id)
        .maybeSingle(),
    );
    if (!emp || emp.status !== "active") throw new ActionError("Pick an active employee.");
    check(
      await ctx.supabase.from("off_day_requests").insert({
        organization_id: ctx.org.id,
        employee_id: v.employee_id,
        work_date: v.work_date,
        message: v.message,
        sent_by: ctx.employee.id,
      }),
    );
  },
);

export const withdrawOffDayRequest = action(
  { schema: z.object({ id: zId }), capability: "overtime" },
  async ({ id }, ctx) => {
    const deleted = check(
      await ctx.supabase
        .from("off_day_requests")
        .delete()
        .eq("id", id)
        .eq("organization_id", ctx.org.id)
        .eq("response", "pending")
        .select("id"),
    );
    if (!deleted?.length) throw new ActionError("Only requests still waiting for an answer can be withdrawn.");
  },
);
