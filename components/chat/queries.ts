import "server-only";
import { can } from "@/lib/auth/permissions";
import type { AuthContext } from "@/lib/auth/session";
import { fullName } from "@/lib/format";
import type { AppRole } from "@/lib/supabase/types";
import type { ChatMessage, ChatPageData, ChatReceipt, ChatRoom, RoomSummary } from "./types";

const MESSAGE_COLUMNS = "id, room_id, sender_id, body, kind, requires_confirmation, deleted_at, created_at";
const isUuid = (v: string | undefined): v is string => !!v && /^[0-9a-f-]{36}$/i.test(v);

/** Everything the chat pages need: my rooms, the open room's messages and receipts. */
export async function loadChat(auth: AuthContext, roomParam: string | undefined): Promise<ChatPageData> {
  const { supabase, org, employee } = auth;

  const [roomsRes, memberRes, peopleRes] = await Promise.all([
    supabase.from("chat_rooms").select("*").eq("organization_id", org.id).eq("archived", false).order("created_at"),
    supabase.from("chat_members").select("room_id").eq("organization_id", org.id).eq("employee_id", employee.id),
    supabase
      .from("employees")
      .select("id, first_name, last_name, role, status")
      .eq("organization_id", org.id)
      .neq("status", "terminated"),
  ]);
  if (roomsRes.error) throw roomsRes.error;
  const explicit = new Set((memberRes.data ?? []).map((m) => m.room_id));
  const people = peopleRes.data ?? [];

  // RLS lets an admin read every room; only list rooms the caller can actually use.
  const mine: ChatRoom[] = (roomsRes.data ?? []).filter((r) =>
    r.kind === "role" || r.kind === "emergency"
      ? r.roles.length === 0 || r.roles.includes(employee.role)
      : explicit.has(r.id),
  );
  const roomIds = mine.map((r) => r.id);
  const names: Record<string, string> = Object.fromEntries(people.map((p) => [p.id, fullName(p)]));

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [latestRes, confirmRes] = roomIds.length
    ? await Promise.all([
        supabase
          .from("chat_messages")
          .select(MESSAGE_COLUMNS)
          .in("room_id", roomIds)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("chat_messages")
          .select("id, room_id")
          .in("room_id", roomIds)
          .eq("requires_confirmation", true)
          .is("deleted_at", null)
          .neq("sender_id", employee.id)
          .gte("created_at", since)
          .limit(200),
      ])
    : [{ data: [] as ChatMessage[] }, { data: [] as { id: string; room_id: string }[] }];

  const lastByRoom = new Map<string, ChatMessage>();
  for (const m of latestRes.data ?? []) if (!lastByRoom.has(m.room_id)) lastByRoom.set(m.room_id, m);

  const confirmIds = (confirmRes.data ?? []).map((m) => m.id);
  const myConfirmed = new Set<string>();
  if (confirmIds.length) {
    const { data } = await supabase
      .from("chat_receipts")
      .select("message_id, confirmed_at")
      .eq("employee_id", employee.id)
      .in("message_id", confirmIds);
    for (const r of data ?? []) if (r.confirmed_at) myConfirmed.add(r.message_id);
  }
  const unconfirmedByRoom = new Map<string, number>();
  for (const m of confirmRes.data ?? []) {
    if (!myConfirmed.has(m.id)) unconfirmedByRoom.set(m.room_id, (unconfirmedByRoom.get(m.room_id) ?? 0) + 1);
  }

  const rooms: RoomSummary[] = mine
    .map((r) => {
      const last = lastByRoom.get(r.id);
      return {
        ...r,
        lastMessage: last
          ? {
              body: last.body,
              created_at: last.created_at,
              sender: last.sender_id ? (names[last.sender_id] ?? null) : null,
              deleted: Boolean(last.deleted_at),
            }
          : null,
        unconfirmed: unconfirmedByRoom.get(r.id) ?? 0,
      };
    })
    .sort((a, b) => (b.lastMessage?.created_at ?? b.created_at).localeCompare(a.lastMessage?.created_at ?? a.created_at));

  const activeRoom = isUuid(roomParam) ? (mine.find((r) => r.id === roomParam) ?? null) : null;
  let messages: ChatMessage[] = [];
  let receipts: ChatReceipt[] = [];
  let memberIds: string[] = [];
  if (activeRoom) {
    const msgRes = await supabase
      .from("chat_messages")
      .select(MESSAGE_COLUMNS)
      .eq("room_id", activeRoom.id)
      .order("created_at", { ascending: false })
      .limit(100);
    messages = (msgRes.data ?? []).reverse();
    const ids = messages.map((m) => m.id);
    if (ids.length) {
      const rr = await supabase
        .from("chat_receipts")
        .select("message_id, employee_id, delivered_at, read_at, confirmed_at")
        .in("message_id", ids);
      receipts = rr.data ?? [];
    }
    const active = people.filter((p) => p.status === "active");
    if (activeRoom.kind === "role" || activeRoom.kind === "emergency") {
      memberIds = active.filter((p) => activeRoom.roles.length === 0 || activeRoom.roles.includes(p.role)).map((p) => p.id);
    } else {
      const mem = await supabase.from("chat_members").select("employee_id").eq("room_id", activeRoom.id);
      const ids2 = new Set((mem.data ?? []).map((m) => m.employee_id));
      memberIds = active.filter((p) => ids2.has(p.id)).map((p) => p.id);
    }
  }

  return {
    rooms,
    activeRoom,
    messages,
    receipts,
    memberIds,
    names,
    people: can(employee.role, "chatManage")
      ? people
          .filter((p) => p.status === "active" && p.id !== employee.id)
          .map((p) => ({ id: p.id, name: fullName(p), role: p.role as AppRole }))
          .sort((a, b) => a.name.localeCompare(b.name))
      : [],
  };
}
