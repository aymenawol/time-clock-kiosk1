"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { action, ActionError, audit, check, zId } from "@/lib/actions";
import { ROLES } from "@/lib/auth/permissions";
import { CHAT_OPS_ROLES, type ChatMessage } from "./types";

const MESSAGE_COLUMNS = "id, room_id, sender_id, body, kind, requires_confirmation, deleted_at, created_at";

/** Send a message. Ops roles may ask for confirmation or send an alert. */
export const sendMessage = action(
  {
    schema: z.object({
      roomId: zId,
      body: z.string().trim().min(1, "Write a message first").max(4000, "Keep messages under 4000 characters"),
      mode: z.enum(["text", "confirm", "alert"]).default("text"),
    }),
    capability: "chat",
  },
  async ({ roomId, body, mode }, ctx): Promise<ChatMessage> => {
    if (mode !== "text" && !CHAT_OPS_ROLES.includes(ctx.employee.role)) {
      throw new ActionError("Only admins, supervisors and dispatchers can request confirmation or send alerts.");
    }
    const { data, error } = await ctx.supabase
      .from("chat_messages")
      .insert({
        organization_id: ctx.org.id,
        room_id: roomId,
        sender_id: ctx.employee.id,
        body,
        kind: mode === "alert" ? "alert" : "text",
        requires_confirmation: mode !== "text",
      })
      .select(MESSAGE_COLUMNS)
      .single();
    if (error) {
      if (error.code === "42501") throw new ActionError("You are not a member of this room.");
      throw error;
    }
    return data;
  },
);

/** Record that I received and read these messages in a room (best effort). */
export const markRead = action(
  { schema: z.object({ messageIds: z.array(zId).min(1).max(100) }), capability: "chat" },
  async ({ messageIds }, ctx) => {
    const now = new Date().toISOString();
    check(
      await ctx.supabase.from("chat_receipts").upsert(
        messageIds.map((id) => ({
          message_id: id,
          employee_id: ctx.employee.id,
          organization_id: ctx.org.id,
          delivered_at: now,
          read_at: now,
        })),
        { onConflict: "message_id,employee_id" },
      ),
    );
    return { at: now };
  },
);

/** Confirm a message that asked for confirmation. */
export const confirmMessage = action({ schema: z.object({ messageId: zId }), capability: "chat" }, async ({ messageId }, ctx) => {
  const now = new Date().toISOString();
  check(
    await ctx.supabase.from("chat_receipts").upsert(
      {
        message_id: messageId,
        employee_id: ctx.employee.id,
        organization_id: ctx.org.id,
        delivered_at: now,
        read_at: now,
        confirmed_at: now,
      },
      { onConflict: "message_id,employee_id" },
    ),
  );
  return { at: now };
});

/** Remove a message (sender or admin). The row stays, marked deleted. */
export const removeMessage = action({ schema: z.object({ messageId: zId }), capability: "chat" }, async ({ messageId }, ctx) => {
  const rows = check(
    await ctx.supabase
      .from("chat_messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", messageId)
      .eq("organization_id", ctx.org.id)
      .select("id"),
  );
  if (!rows || rows.length === 0) throw new ActionError("You can only remove your own messages.");
});

/** Create a group room (named members) or a role room (everyone with those roles). */
export const createRoom = action(
  {
    schema: z
      .object({
        name: z.string().trim().min(1, "Name the room").max(80),
        kind: z.enum(["group", "role"]),
        memberIds: z.array(zId).max(500).default([]),
        roles: z.array(z.enum(ROLES)).default([]),
      })
      .superRefine((v, c) => {
        if (v.kind === "group" && v.memberIds.length === 0) c.addIssue({ code: "custom", path: ["memberIds"], message: "Pick at least one member" });
        if (v.kind === "role" && v.roles.length === 0) c.addIssue({ code: "custom", path: ["roles"], message: "Pick at least one role" });
      }),
    capability: "chatManage",
  },
  async ({ name, kind, memberIds, roles }, ctx) => {
    // Generate the id here: the creator may not be able to read the room until they are a member.
    const id = randomUUID();
    check(
      await ctx.supabase.from("chat_rooms").insert({
        id,
        organization_id: ctx.org.id,
        name,
        kind,
        roles: kind === "role" ? roles : [],
        created_by: ctx.employee.id,
      }),
    );
    if (kind === "group") {
      const members = [...new Set([ctx.employee.id, ...memberIds])];
      check(
        await ctx.supabase
          .from("chat_members")
          .insert(members.map((employee_id) => ({ room_id: id, employee_id, organization_id: ctx.org.id }))),
      );
    }
    await audit(ctx, "chat.room.create", "chat_rooms", id, { kind, name });
    return { id };
  },
);

/** Archive a room: it leaves everyone's list but keeps its history. */
export const archiveRoom = action({ schema: z.object({ roomId: zId }), capability: "chatManage" }, async ({ roomId }, ctx) => {
  const rows = check(
    await ctx.supabase.from("chat_rooms").update({ archived: true }).eq("id", roomId).eq("organization_id", ctx.org.id).select("id"),
  );
  if (!rows || rows.length === 0) throw new ActionError("That room no longer exists.");
  await audit(ctx, "chat.room.archive", "chat_rooms", roomId);
});
