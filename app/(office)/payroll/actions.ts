"use server";

import { z } from "zod";
import { action, ActionError, audit, check, zId } from "@/lib/actions";
import { YMD } from "@/lib/scheduling/datetime";
import { lockPayload, periodDatesProblem } from "@/lib/scheduling/pay-periods";
import { loadPeriodData } from "./_lib/load";

export const createPeriod = action(
  {
    schema: z.object({
      starts_on: z.string().regex(YMD, "Pick the first day."),
      ends_on: z.string().regex(YMD, "Pick the last day."),
      pay_date: z.string().regex(YMD, "Pick the pay date."),
    }),
    capability: "payroll",
  },
  async (v, ctx) => {
    const problem = periodDatesProblem(v.starts_on, v.ends_on, v.pay_date);
    if (problem) throw new ActionError(problem);
    const { data, error } = await ctx.supabase
      .from("pay_periods")
      .insert({
        organization_id: ctx.org.id,
        starts_on: v.starts_on,
        ends_on: v.ends_on,
        pay_date: v.pay_date,
        created_by: ctx.employee.id,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23P01") throw new ActionError("That overlaps another pay period. Pick dates that don't overlap.");
      throw error;
    }
    await audit(ctx, "pay_period.create", "pay_periods", data.id, v);
    return { id: data.id };
  },
);

export const lockPeriod = action(
  { schema: z.object({ id: zId }), capability: "payroll" },
  async ({ id }, ctx) => {
    const period = check(
      await ctx.supabase
        .from("pay_periods")
        .select("id, starts_on, ends_on, status")
        .eq("id", id)
        .eq("organization_id", ctx.org.id)
        .maybeSingle(),
    );
    if (!period) throw new ActionError("That pay period no longer exists.");
    if (period.status !== "open") throw new ActionError("This pay period is already locked.");

    const data = await loadPeriodData(ctx, period);
    if (data.openShifts.length > 0) {
      throw new ActionError(
        `${data.openShifts.length} shift${data.openShifts.length === 1 ? " is" : "s are"} still open. Fix the clock-outs on the timesheets page, then lock.`,
      );
    }
    const n = check(await ctx.supabase.rpc("lock_pay_period", { p_period_id: id, p_lines: lockPayload(data.lines) as never }));
    await audit(ctx, "pay_period.lock", "pay_periods", id, { lines: n ?? data.lines.length });
    return { lines: n ?? data.lines.length };
  },
);

export const unlockPeriod = action(
  { schema: z.object({ id: zId, reason: z.string().trim().min(3, "Say why you are unlocking.").max(500) }), capability: "payroll" },
  async ({ id, reason }, ctx) => {
    const period = check(
      await ctx.supabase.from("pay_periods").select("id").eq("id", id).eq("organization_id", ctx.org.id).maybeSingle(),
    );
    if (!period) throw new ActionError("That pay period no longer exists.");
    check(await ctx.supabase.rpc("unlock_pay_period", { p_period_id: id }));
    await audit(ctx, "pay_period.unlock", "pay_periods", id, { reason });
  },
);
