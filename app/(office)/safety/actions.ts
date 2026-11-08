"use server";

import { z } from "zod";
import { inputToIso } from "@/components/people/tz";
import { action, ActionError, audit, check, zId } from "@/lib/actions";
import { ROLES } from "@/lib/auth/permissions";

const meetingFields = {
  title: z.string().trim().min(1, "Enter a title").max(120),
  audience: z.array(z.enum(ROLES)).max(ROLES.length),
  startsAt: z.string().min(1, "Pick a date and time"),
  duration: z.coerce.number().int().min(5, "At least 5 minutes").max(480, "At most 8 hours"),
  location: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
};

export const createMeeting = action(
  { schema: z.object(meetingFields), capability: "safetyManage" },
  async (v, ctx) => {
    const startsAt = inputToIso(v.startsAt, ctx.org.timezone);
    if (!startsAt) throw new ActionError("That date and time is not valid.");
    const { data, error } = await ctx.supabase
      .from("safety_meetings")
      .insert({
        organization_id: ctx.org.id,
        title: v.title,
        audience: v.audience,
        starts_at: startsAt,
        duration_minutes: v.duration,
        location: v.location || null,
        notes: v.notes || null,
        created_by: ctx.employee.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    await audit(ctx, "safety.meeting_create", "safety_meetings", data.id, { title: v.title });
    return { id: data.id };
  },
);

export const updateMeeting = action(
  { schema: z.object({ id: zId, ...meetingFields }), capability: "safetyManage" },
  async ({ id, ...v }, ctx) => {
    const startsAt = inputToIso(v.startsAt, ctx.org.timezone);
    if (!startsAt) throw new ActionError("That date and time is not valid.");
    check(
      await ctx.supabase
        .from("safety_meetings")
        .update({
          title: v.title,
          audience: v.audience,
          starts_at: startsAt,
          duration_minutes: v.duration,
          location: v.location || null,
          notes: v.notes || null,
        })
        .eq("id", id)
        .eq("organization_id", ctx.org.id),
    );
    await audit(ctx, "safety.meeting_update", "safety_meetings", id, { title: v.title });
  },
);

export const setMeetingStatus = action(
  { schema: z.object({ id: zId, status: z.enum(["scheduled", "completed", "cancelled"]) }), capability: "safetyManage" },
  async ({ id, status }, ctx) => {
    check(await ctx.supabase.from("safety_meetings").update({ status }).eq("id", id).eq("organization_id", ctx.org.id));
    await audit(ctx, `safety.meeting_${status}`, "safety_meetings", id);
  },
);

export const recordAttendance = action(
  {
    schema: z.object({
      meetingId: zId,
      employeeId: zId,
      status: z.enum(["present", "late", "absent", "excused"]),
    }),
    capability: "safety",
  },
  async (v, ctx) => {
    const [{ data: meeting }, { data: employee }] = await Promise.all([
      ctx.supabase.from("safety_meetings").select("id").eq("id", v.meetingId).eq("organization_id", ctx.org.id).maybeSingle(),
      ctx.supabase.from("employees").select("id").eq("id", v.employeeId).eq("organization_id", ctx.org.id).maybeSingle(),
    ]);
    if (!meeting || !employee) throw new ActionError("Meeting or employee not found.");
    check(
      await ctx.supabase.from("safety_attendance").upsert(
        {
          meeting_id: v.meetingId,
          employee_id: v.employeeId,
          organization_id: ctx.org.id,
          status: v.status,
          recorded_by: ctx.employee.id,
          ...(v.status === "present" || v.status === "late" ? { signed_in_at: new Date().toISOString() } : {}),
        },
        { onConflict: "meeting_id,employee_id" },
      ),
    );
  },
);

export const markAllPresent = action(
  { schema: z.object({ meetingId: zId, employeeIds: z.array(zId).max(2000) }), capability: "safety" },
  async (v, ctx) => {
    const { data: meeting } = await ctx.supabase
      .from("safety_meetings")
      .select("id")
      .eq("id", v.meetingId)
      .eq("organization_id", ctx.org.id)
      .maybeSingle();
    if (!meeting) throw new ActionError("Meeting not found.");
    // Keep anything already recorded; only fill the blanks.
    const { data: existing } = await ctx.supabase.from("safety_attendance").select("employee_id").eq("meeting_id", v.meetingId);
    const done = new Set((existing ?? []).map((e) => e.employee_id));
    const { data: inOrg } = v.employeeIds.length
      ? await ctx.supabase.from("employees").select("id").eq("organization_id", ctx.org.id).in("id", v.employeeIds)
      : { data: [] };
    const valid = new Set((inOrg ?? []).map((e) => e.id));
    const rows = v.employeeIds
      .filter((id) => valid.has(id) && !done.has(id))
      .map((employee_id) => ({
        meeting_id: v.meetingId,
        employee_id,
        organization_id: ctx.org.id,
        status: "present" as const,
        recorded_by: ctx.employee.id,
        signed_in_at: new Date().toISOString(),
      }));
    if (rows.length) check(await ctx.supabase.from("safety_attendance").insert(rows));
    return { added: rows.length };
  },
);
