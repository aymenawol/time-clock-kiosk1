import type { Metadata } from "next";
import { ChatShell } from "@/components/chat/chat-shell";
import { loadChat } from "@/components/chat/queries";
import { CHAT_OPS_ROLES } from "@/components/chat/types";
import { LiveRefresh } from "@/components/realtime/use-live-refresh";
import { can } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Chat" };

export default async function FieldChatPage({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
  const auth = await requireAuth("chat");
  const { room } = await searchParams;
  const data = await loadChat(auth, room);
  const role = auth.employee.role;

  return (
    <>
      <LiveRefresh organizationId={auth.org.id} tables={["chat_messages"]} debounceMs={2000} />
      {data.activeRoom ? null : <h1 className="mb-3 text-xl font-semibold tracking-tight">Chat</h1>}
      <ChatShell
        data={data}
        basePath="/m/chat"
        mode="field"
        organizationId={auth.org.id}
        meId={auth.employee.id}
        isOps={CHAT_OPS_ROLES.includes(role)}
        isAdmin={role === "admin"}
        canManage={can(role, "chatManage")}
        timeZone={auth.org.timezone}
        clock24h={auth.settings.clock24h}
      />
    </>
  );
}
