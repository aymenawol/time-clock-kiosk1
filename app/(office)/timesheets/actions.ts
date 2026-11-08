"use server";

import { z } from "zod";
import { action, ActionError, audit, check, zId } from "@/lib/actions";
import { localDate } from "@/lib/labor/time";
import { inputToIso } from "@/components/people/tz";

const reason = z.string().trim().min(3, "Give a reason for the change").max(500);
const dateTime = z.string().min(1, "Enter a date and time");

function toIso(value: string, tz: string, label: string): string {
  const iso = inputToIso(value, tz);
  if (!iso) throw new ActionError(`${label} is not a valid date and time.`);
  return iso;
}

export const editShift = action(
  {
    schema: z.object({ id: zId, clockIn: dateTime, clockOut: z.string().optional(), reason }),
    capability: "timesheets",
  },
  async (v, ctx) => {
    const tz = ctx.org.timezone;
    const { data: shift } = await ctx.supabase
      .from("shifts")
      .select("id, status, clock_in_at, clock_out_at, employee_id")
      .eq("id", v.id)
      .eq("organization_id", ctx.org.id)
      .maybeSingle();
    if (!shift) throw new ActionError("Shift not found.");
    if (shift.status === "void") throw new ActionError("A voided shift cannot be edited.");

    const clockIn = toIso(v.clockIn, tz, "Clock in");
    const clockOut = v.clockOut ? toIso(v.clockOut, tz, "Clock out") : null;
    if (shift.status === "completed" && !clockOut) throw new ActionError("A completed shift needs a clock out time.");
    if (clockOut && clockOut <= clockIn) throw new ActionError("Clock out must be after clock in.");
    if (new Date(clockIn) > new Date()) throw new ActionError("Clock in cannot be in the future.");

    const patch = {
      clock_in_at: clockIn,
      clock_out_at: clockOut,
      work_date: localDate(new Date(clockIn), tz),
      edited_by: ctx.employee.id,
      edit_reason: v.reason,
      ...(clockOut && shift.status === "active" ? { status: "completed" as const, source_out: "admin" } : {}),
    };
    check(await ctx.supabase.from("shifts").update(patch).eq("id", v.id).eq("organization_id", ctx.org.id));
    await audit(ctx, "shift.edit", "shifts", v.id, {
      employee_id: shift.employee_id,
      from: { in: shift.clock_in_at, out: shift.clock_out_at },
      to: { in: clockIn, out: clockOut },
      reason: v.reason,
    });
  },
);

export const addShift = action(
  {
    schema: z.object({ employeeId: zId, clockIn: dateTime, clockOut: dateTime, reason }),
    capability: "timesheets",
  },
  async (v, ctx) => {
    const tz = ctx.org.timezone;
    const { data: employee } = await ctx.supabase
      .from("employees")
      .select("id")
      .eq("id", v.employeeId)
      .eq("organization_id", ctx.org.id)
      .maybeSingle();
    if (!employee) throw new ActionError("Employee not found.");
    const clockIn = toIso(v.clockIn, tz, "Clock in");
    const clockOut = toIso(v.clockOut, tz, "Clock out");
    if (clockOut <= clockIn) throw new ActionError("Clock out must be after clock in.");
    if (new Date(clockOut) > new Date()) throw new ActionError("A missed shift must be in the past.");

    const { data: created, error } = await ctx.supabase
      .from("shifts")
      .insert({
        organization_id: ctx.org.id,
        employee_id: v.employeeId,
        work_date: localDate(new Date(clockIn), tz),
        clock_in_at: clockIn,
        clock_out_at: clockOut,
        status: "completed",
        source_in: "admin",
        source_out: "admin",
        edited_by: ctx.employee.id,
        edit_reason: v.reason,
      })
      .select("id")
      .single();
    if (error) throw error;
    await audit(ctx, "shift.add", "shifts", created.id, { employee_id: v.employeeId, in: clockIn, out: clockOut, reason: v.reason });
  },
);

export const voidShift = action(
  { schema: z.object({ id: zId, reason }), capability: "timesheets" },
  async (v, ctx) => {
    const { data: shift } = await ctx.supabase
      .from("shifts")
      .select("id, status, employee_id")
      .eq("id", v.id)
      .eq("organization_id", ctx.org.id)
      .maybeSingle();
    if (!shift) throw new ActionError("Shift not found.");
    if (shift.status === "void") throw new ActionError("This shift is already void.");
    check(
      await ctx.supabase
        .from("shifts")
        .update({ status: "void", edited_by: ctx.employee.id, edit_reason: v.reason })
        .eq("id", v.id)
        .eq("organization_id", ctx.org.id),
    );
    await audit(ctx, "shift.void", "shifts", v.id, { employee_id: shift.employee_id, reason: v.reason });
  },
);

export const editBreak = action(
  {
    schema: z.object({ id: zId, startedAt: dateTime, endedAt: z.string().optional(), reason }),
    capability: "timesheets",
  },
  async (v, ctx) => {
    const tz = ctx.org.timezone;
    const { data: brk } = await ctx.supabase
      .from("breaks")
      .select("id, shift_id, status, started_at, ended_at")
      .eq("id", v.id)
      .eq("organization_id", ctx.org.id)
      .maybeSingle();
    if (!brk) throw new ActionError("Break not found.");
    const startedAt = toIso(v.startedAt, tz, "Break start");
    const endedAt = v.endedAt ? toIso(v.endedAt, tz, "Break end") : null;
    if (endedAt && endedAt < startedAt) throw new ActionError("The break cannot end before it starts.");

    // Touching the parent shift first applies the locked-pay-period guard and records who edited.
    check(
      await ctx.supabase
        .from("shifts")
        .update({ edited_by: ctx.employee.id, edit_reason: v.reason })
        .eq("id", brk.shift_id)
        .eq("organization_id", ctx.org.id),
    );
    const status = endedAt ? (brk.status === "overrun" ? "overrun" : "completed") : "active";
    check(
      await ctx.supabase
        .from("breaks")
        .update({ started_at: startedAt, ended_at: endedAt, status })
        .eq("id", v.id)
        .eq("organization_id", ctx.org.id),
    );
    await audit(ctx, "break.edit", "breaks", v.id, {
      shift_id: brk.shift_id,
      from: { start: brk.started_at, end: brk.ended_at },
      to: { start: startedAt, end: endedAt },
      reason: v.reason,
    });
  },
);
