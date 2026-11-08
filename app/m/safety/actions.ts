"use server";

import { z } from "zod";
import { action, ActionError, zId } from "@/lib/actions";

export const signInToMeeting = action({ schema: z.object({ meetingId: zId }), capability: "field" }, async ({ meetingId }, ctx) => {
  const { data, error } = await ctx.supabase.rpc("safety_sign_in", { p_meeting_id: meetingId });
  if (error) throw error;
  if (data !== "present" && data !== "late") throw new ActionError("Could not sign you in.");
  return { status: data as "present" | "late" };
});
