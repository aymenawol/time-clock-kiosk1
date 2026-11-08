import type { AppRole } from "@/lib/supabase/types";

/** Roles that may mark a message "needs confirmation" or send it as an alert. */
export const CHAT_OPS_ROLES: readonly AppRole[] = ["admin", "supervisor", "dispatcher"];

export interface ChatRoom {
  id: string;
  name: string;
  kind: string;
  roles: AppRole[];
  archived: boolean;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string | null;
  body: string;
  kind: string;
  requires_confirmation: boolean;
  deleted_at: string | null;
  created_at: string;
}

export interface ChatReceipt {
  message_id: string;
  employee_id: string;
  delivered_at: string | null;
  read_at: string | null;
  confirmed_at: string | null;
}

export interface RoomSummary extends ChatRoom {
  lastMessage: { body: string; created_at: string; sender: string | null; deleted: boolean } | null;
  /** Messages in this room that need my confirmation. */
  unconfirmed: number;
}

export interface ChatPerson {
  id: string;
  name: string;
  role: AppRole;
}

export interface ChatPageData {
  rooms: RoomSummary[];
  activeRoom: ChatRoom | null;
  messages: ChatMessage[];
  receipts: ChatReceipt[];
  /** Active employees who are in the active room. */
  memberIds: string[];
  names: Record<string, string>;
  /** Everyone assignable to a new group room (only when the caller can manage rooms). */
  people: ChatPerson[];
}
