"use client";

import { Archive, ArrowLeft, Hash, MessageSquare, Radio, ShieldAlert, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";
import { fmtDate, fmtTime, todayIn } from "@/lib/format";
import { archiveRoom } from "./actions";
import { Conversation } from "./conversation";
import { NewRoomDialog } from "./new-room-dialog";
import type { ChatPageData, RoomSummary } from "./types";

interface Props {
  data: ChatPageData;
  basePath: string;
  /** "office" shows the list beside the conversation from md up; "field" is always one column. */
  mode: "office" | "field";
  organizationId: string;
  meId: string;
  isOps: boolean;
  canManage: boolean;
  isAdmin: boolean;
  timeZone: string;
  clock24h: boolean;
}

const KIND_ICON = { group: Users, role: Hash, emergency: ShieldAlert, direct: MessageSquare } as const;
const KIND_LABEL: Record<string, string> = { group: "Group", role: "Role", emergency: "Emergency", direct: "Direct" };

export function ChatShell(props: Props) {
  const { data, basePath, mode, timeZone, clock24h } = props;
  const router = useRouter();
  const room = data.activeRoom;
  const first = data.rooms[0]?.id;

  // On wide office screens open the most recent room instead of an empty pane.
  useEffect(() => {
    if (mode === "office" && !room && first && window.matchMedia("(min-width: 768px)").matches) {
      router.replace(`${basePath}?room=${first}`);
    }
  }, [mode, room, first, basePath, router]);

  const office = mode === "office";
  return (
    <div
      className={cn(
        office && "overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface md:grid md:grid-cols-[320px_minmax(0,1fr)]",
        office && "h-[calc(100dvh-9.5rem)] min-h-[30rem]",
      )}
    >
      <aside
        aria-label="Chat rooms"
        className={cn(
          "flex min-h-0 flex-col",
          office && "border-border md:border-r",
          room && (office ? "hidden md:flex" : "hidden"),
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">Rooms</h2>
          {props.canManage ? <NewRoomDialog people={data.people} basePath={basePath} /> : null}
        </div>
        {data.rooms.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center text-sm text-muted">
            <MessageSquare className="size-6" aria-hidden />
            <p className="font-medium text-fg">No rooms yet</p>
            <p>{props.canManage ? "Create a room to start a conversation." : "You will see rooms here when a supervisor adds you to one."}</p>
          </div>
        ) : (
          <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
            {data.rooms.map((r) => (
              <li key={r.id}>
                <RoomLink room={r} href={`${basePath}?room=${r.id}`} active={r.id === room?.id} timeZone={timeZone} clock24h={clock24h} />
              </li>
            ))}
          </ul>
        )}
      </aside>

      {room ? (
        <section aria-label={room.name} className={cn("flex min-h-0 min-w-0 flex-col", office ? "h-full" : "")}>
          <header className="flex items-center gap-2 border-b border-border px-3 py-2.5 sm:px-4">
            <Link
              href={basePath}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-fg hover:bg-surface-2 md:hidden"
              aria-label="Back to rooms"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold">{room.name}</h2>
              <p className="text-xs text-muted">
                {KIND_LABEL[room.kind] ?? room.kind} · {data.memberIds.length} member{data.memberIds.length === 1 ? "" : "s"}
              </p>
            </div>
            {props.canManage ? <ArchiveButton roomId={room.id} name={room.name} basePath={basePath} /> : null}
          </header>
          <Conversation
            key={room.id}
            roomId={room.id}
            organizationId={props.organizationId}
            meId={props.meId}
            isOps={props.isOps}
            isAdmin={props.isAdmin}
            names={data.names}
            memberIds={data.memberIds}
            messages={data.messages}
            receipts={data.receipts}
            timeZone={timeZone}
            clock24h={clock24h}
            layout={office ? "panel" : "page"}
          />
        </section>
      ) : office ? (
        <div className="hidden flex-col items-center justify-center gap-2 text-sm text-muted md:flex">
          <MessageSquare className="size-8" aria-hidden />
          Select a room to start chatting
        </div>
      ) : null}
    </div>
  );
}

function RoomLink({
  room,
  href,
  active,
  timeZone,
  clock24h,
}: {
  room: RoomSummary;
  href: string;
  active: boolean;
  timeZone: string;
  clock24h: boolean;
}) {
  const Icon = KIND_ICON[room.kind as keyof typeof KIND_ICON] ?? Radio;
  const last = room.lastMessage;
  const today = todayIn(timeZone);
  const when = last
    ? today === fmtDate(last.created_at, timeZone, "yyyy-MM-dd")
      ? fmtTime(last.created_at, timeZone, clock24h)
      : fmtDate(last.created_at, timeZone, "MMM d")
    : "";
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("flex min-h-16 items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2", active && "bg-primary-soft")}
    >
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
        <Icon className={cn("size-4", room.kind === "emergency" && "text-danger")} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold">{room.name}</span>
          <span className="tabular shrink-0 text-xs text-muted">{when}</span>
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm text-muted">
            {last ? (last.deleted ? "Message removed" : `${last.sender ? `${last.sender.split(" ")[0]}: ` : ""}${last.body}`) : "No messages yet"}
          </span>
          {room.unconfirmed > 0 ? (
            <Badge tone="danger" className="shrink-0" aria-label={`${room.unconfirmed} to confirm`}>
              {room.unconfirmed}
            </Badge>
          ) : null}
        </span>
      </span>
    </Link>
  );
}

function ArchiveButton({ roomId, name, basePath }: { roomId: string; name: string; basePath: string }) {
  const router = useRouter();
  const [run, pending] = useAction(archiveRoom, { success: "Room archived", onSuccess: () => router.replace(basePath) });
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Archive ${name}`}>
          <Archive />
        </Button>
      </DialogTrigger>
      <DialogContent title={`Archive ${name}?`} description="It leaves everyone's room list. The history is kept.">
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button variant="danger" loading={pending} onClick={() => void run({ roomId })}>
            Archive room
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
