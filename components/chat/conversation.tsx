"use client";

import { Check, CheckCheck, MessageSquare, Send, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";
import { fmtDate, fmtTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { confirmMessage, markRead, removeMessage, sendMessage } from "./actions";
import type { ChatMessage, ChatReceipt } from "./types";

type Mode = "text" | "confirm" | "alert";
const key = (r: Pick<ChatReceipt, "message_id" | "employee_id">) => `${r.message_id}:${r.employee_id}`;

interface Props {
  roomId: string;
  organizationId: string;
  meId: string;
  isOps: boolean;
  isAdmin: boolean;
  names: Record<string, string>;
  memberIds: string[];
  messages: ChatMessage[];
  receipts: ChatReceipt[];
  timeZone: string;
  clock24h: boolean;
  /** "panel": scrolls inside a fixed-height pane. "page": flows in the page with a sticky composer. */
  layout: "panel" | "page";
}

export function Conversation(props: Props) {
  const { roomId, organizationId, meId, isOps, isAdmin, names, memberIds, timeZone, clock24h, layout } = props;
  const [liveMessages, setLiveMessages] = useState<Record<string, ChatMessage>>({});
  const [liveReceipts, setLiveReceipts] = useState<Record<string, ChatReceipt>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const sentReceipts = useRef(new Set<string>());

  const messages = useMemo(() => {
    const byId = new Map(props.messages.map((m) => [m.id, m]));
    for (const m of Object.values(liveMessages)) byId.set(m.id, m);
    return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [props.messages, liveMessages]);

  const receipts = useMemo(() => {
    const byKey = new Map(props.receipts.map((r) => [key(r), r]));
    for (const r of Object.values(liveReceipts)) byKey.set(key(r), { ...byKey.get(key(r)), ...r });
    const byMessage = new Map<string, ChatReceipt[]>();
    for (const r of byKey.values()) byMessage.set(r.message_id, [...(byMessage.get(r.message_id) ?? []), r]);
    return byMessage;
  }, [props.receipts, liveReceipts]);

  const messageIds = useRef(new Set<string>());
  useEffect(() => {
    messageIds.current = new Set(messages.map((m) => m.id));
  }, [messages]);

  // Live messages for this room and receipts for the organization.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat:${roomId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
        (p) => setLiveMessages((prev) => ({ ...prev, [(p.new as ChatMessage).id]: p.new as ChatMessage })),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
        (p) => setLiveMessages((prev) => ({ ...prev, [(p.new as ChatMessage).id]: p.new as ChatMessage })),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_receipts", filter: `organization_id=eq.${organizationId}` },
        (p) => {
          const r = p.new as ChatReceipt;
          if (!r.message_id || !messageIds.current.has(r.message_id)) return;
          setLiveReceipts((prev) => ({ ...prev, [key(r)]: r }));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, organizationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // Mark others' messages delivered and read once they are on screen.
  useEffect(() => {
    const mine = new Set((receipts && [...receipts.values()].flat()).filter((r) => r.employee_id === meId && r.read_at).map((r) => r.message_id));
    const todo = messages
      .filter((m) => m.sender_id !== meId && !m.deleted_at && !mine.has(m.id) && !sentReceipts.current.has(m.id))
      .map((m) => m.id)
      .slice(-100);
    if (todo.length === 0) return;
    for (const id of todo) sentReceipts.current.add(id);
    void markRead({ messageIds: todo }).then((res) => {
      if (!res.ok) {
        for (const id of todo) sentReceipts.current.delete(id);
        return;
      }
      setLiveReceipts((prev) => {
        const next = { ...prev };
        for (const id of todo) {
          const r = { message_id: id, employee_id: meId, delivered_at: res.data.at, read_at: res.data.at, confirmed_at: null };
          next[key(r)] = { ...next[key(r)], ...r, confirmed_at: next[key(r)]?.confirmed_at ?? null };
        }
        return next;
      });
    });
  }, [messages, receipts, meId]);

  const onSent = useCallback((m: ChatMessage) => setLiveMessages((prev) => ({ ...prev, [m.id]: m })), []);
  const onConfirmed = useCallback(
    (messageId: string, at: string) =>
      setLiveReceipts((prev) => {
        const r = { message_id: messageId, employee_id: meId, delivered_at: at, read_at: at, confirmed_at: at };
        return { ...prev, [key(r)]: r };
      }),
    [meId],
  );

  return (
    <>
      <div
        className={cn(
          "flex flex-col gap-3 px-3 py-4 sm:px-4",
          layout === "panel" ? "min-h-0 flex-1 overflow-y-auto" : "flex-1 pb-6",
        )}
        role="log"
        aria-live="polite"
        aria-label="Messages"
      >
        {messages.length === 0 ? (
          <div className="m-auto flex flex-col items-center gap-2 py-12 text-sm text-muted">
            <MessageSquare className="size-6" aria-hidden />
            No messages yet. Say hello.
          </div>
        ) : null}
        {messages.map((m, i) => {
          const day = fmtDate(m.created_at, timeZone, "yyyy-MM-dd");
          const divider = i === 0 || day !== fmtDate(messages[i - 1].created_at, timeZone, "yyyy-MM-dd");
          return (
            <div key={m.id} className="flex flex-col gap-3">
              {divider ? (
                <p className="self-center rounded-full bg-surface-2 px-3 py-0.5 text-xs text-muted">{fmtDate(m.created_at, timeZone, "EEE, MMM d")}</p>
              ) : null}
              <Bubble
                m={m}
                own={m.sender_id === meId}
                senderName={m.sender_id ? (names[m.sender_id] ?? "Former employee") : "System"}
                receipts={receipts.get(m.id) ?? []}
                meId={meId}
                isOps={isOps}
                isAdmin={isAdmin}
                memberIds={memberIds}
                timeZone={timeZone}
                clock24h={clock24h}
                large={layout === "page"}
                onConfirmed={onConfirmed}
              />
            </div>
          );
        })}
        <div ref={bottomRef} className="scroll-mb-44" />
      </div>
      <Composer roomId={roomId} isOps={isOps} layout={layout} onSent={onSent} />
    </>
  );
}

function Bubble({
  m,
  own,
  senderName,
  receipts,
  meId,
  isOps,
  isAdmin,
  memberIds,
  timeZone,
  clock24h,
  large,
  onConfirmed,
}: {
  m: ChatMessage;
  own: boolean;
  senderName: string;
  receipts: ChatReceipt[];
  meId: string;
  isOps: boolean;
  isAdmin: boolean;
  memberIds: string[];
  timeZone: string;
  clock24h: boolean;
  large: boolean;
  onConfirmed: (messageId: string, at: string) => void;
}) {
  const [confirm, confirming] = useAction(confirmMessage, { refresh: true, onSuccess: (d) => onConfirmed(m.id, d.at) });
  const [remove, removing] = useAction(removeMessage, { success: "Message removed" });
  const deleted = Boolean(m.deleted_at);
  const needsConfirm = (m.requires_confirmation || m.kind === "alert") && !deleted;
  const alert = m.kind === "alert";

  const others = memberIds.filter((id) => id !== m.sender_id);
  const total = others.length;
  const count = (f: keyof ChatReceipt) => receipts.filter((r) => others.includes(r.employee_id) && r[f]).length;
  const confirmed = count("confirmed_at");
  const read = count("read_at");
  const delivered = count("delivered_at");
  const iConfirmed = receipts.some((r) => r.employee_id === meId && r.confirmed_at);
  const showReceipts = !deleted && (own || isOps);

  return (
    <div className={cn("flex", own ? "justify-end" : "justify-start")}>
      <div className={cn("flex max-w-[88%] min-w-0 flex-col gap-1 sm:max-w-[34rem]", own ? "items-end" : "items-start")}>
        {!own ? <span className="max-w-full truncate px-1 text-xs text-muted">{senderName}</span> : null}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5",
            deleted
              ? "bg-surface-2 italic text-muted"
              : alert
                ? "border border-danger/40 bg-danger-soft text-fg"
                : own
                  ? "bg-primary text-primary-fg"
                  : "bg-surface-2 text-fg",
          )}
        >
          {alert && !deleted ? (
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-danger">
              <ShieldAlert className="size-3.5" aria-hidden /> Alert
            </p>
          ) : null}
          <p className="whitespace-pre-wrap break-words text-sm">{deleted ? "Message removed" : m.body}</p>
        </div>

        {needsConfirm ? (
          <div className="flex flex-wrap items-center gap-2 px-1">
            {showReceipts ? (
              <Badge tone={confirmed >= total && total > 0 ? "success" : "warning"}>
                {confirmed} of {total} confirmed
              </Badge>
            ) : null}
            {!own ? (
              iConfirmed ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                  <ShieldCheck className="size-3.5" aria-hidden /> Confirmed
                </span>
              ) : (
                <Button size={large ? "lg" : "sm"} variant="success" loading={confirming} onClick={() => void confirm({ messageId: m.id })}>
                  <Check />
                  Confirm
                </Button>
              )
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-muted">
          <span className="tabular">{fmtTime(m.created_at, timeZone, clock24h)}</span>
          {own && !deleted && !needsConfirm ? (
            <span className="inline-flex items-center gap-1" title="Sent, delivered, read">
              {read > 0 ? <CheckCheck className="size-3.5 text-info" aria-hidden /> : delivered > 0 ? <CheckCheck className="size-3.5" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
              {read > 0 ? `Read by ${read}` : delivered > 0 ? `Delivered to ${delivered}` : "Sent"}
            </span>
          ) : null}
          {own && !deleted && needsConfirm ? (
            <span className="tabular">
              Read {read} of {total}
            </span>
          ) : null}
          {(own || isAdmin) && !deleted ? (
            <button
              type="button"
              disabled={removing}
              onClick={() => void remove({ messageId: m.id })}
              className="inline-flex items-center gap-1 hover:text-danger focus-visible:text-danger"
              aria-label="Remove message"
            >
              <Trash2 className="size-3.5" aria-hidden />
              Remove
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Composer({ roomId, isOps, layout, onSent }: { roomId: string; isOps: boolean; layout: "panel" | "page"; onSent: (m: ChatMessage) => void }) {
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<Mode>("text");
  const [send, sending] = useAction(sendMessage, {
    refresh: false,
    onSuccess: (m) => {
      onSent(m);
      setBody("");
      setMode("text");
    },
  });
  const submit = () => {
    if (!body.trim() || sending) return;
    void send({ roomId, body, mode });
  };
  return (
    <form
      className={cn(
        "border-t border-border bg-surface p-3 sm:p-4",
        layout === "page" && "sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20",
      )}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {isOps ? (
        <div className="mb-2 flex items-center gap-2">
          <label className="sr-only" htmlFor={`mode-${roomId}`}>
            Message type
          </label>
          <Select id={`mode-${roomId}`} value={mode} onChange={(e) => setMode(e.target.value as Mode)} className="h-9 w-auto max-w-full text-xs">
            <option value="text">Normal message</option>
            <option value="confirm">Needs confirmation from everyone</option>
            <option value="alert">Alert (needs confirmation, notifies as critical)</option>
          </Select>
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <label className="sr-only" htmlFor={`body-${roomId}`}>
          Message
        </label>
        <Textarea
          id={`body-${roomId}`}
          value={body}
          rows={layout === "page" ? 2 : 2}
          maxLength={4000}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Write a message"
          className="min-h-12 flex-1 resize-none"
        />
        <Button type="submit" size={layout === "page" ? "lg" : "md"} loading={sending} disabled={!body.trim()} aria-label="Send message">
          <Send />
          <span className="hidden sm:inline">Send</span>
        </Button>
      </div>
    </form>
  );
}
