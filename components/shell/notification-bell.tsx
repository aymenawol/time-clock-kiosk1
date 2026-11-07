"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Popover } from "radix-ui";
import { cn } from "@/lib/cn";
import { fmtAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";

type N = Pick<Tables<"notifications">, "id" | "title" | "body" | "link" | "severity" | "read_at" | "created_at">;

export function NotificationBell({ employeeId, className }: { employeeId: string; className?: string }) {
  const [items, setItems] = useState<N[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("id,title,body,link,severity,read_at,created_at")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems(data ?? []);
  }, [employeeId]);

  useEffect(() => {
    const supabase = createClient();
    const initial = setTimeout(() => void load(), 0);
    const channel = supabase
      .channel(`bell:${employeeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `employee_id=eq.${employeeId}` }, () => void load())
      .subscribe();
    return () => {
      clearTimeout(initial);
      void supabase.removeChannel(channel);
    };
  }, [employeeId, load]);

  const unread = items.filter((n) => !n.read_at).length;

  async function markAllRead() {
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    if (!ids.length) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await createClient().from("notifications").update({ read_at: now }).in("id", ids);
  }

  async function markRead(id: string) {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: now } : n)));
    await createClient().from("notifications").update({ read_at: now }).eq("id", id);
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn("relative rounded-[var(--radius-control)] p-2 text-muted hover:bg-surface-2 hover:text-fg", className)}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <Bell className="size-5" />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-4 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[min(24rem,calc(100vw-1rem))] rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-pop)]"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-sm font-semibold">Notifications</p>
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1 text-xs text-primary disabled:opacity-40"
              disabled={!unread}
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? <li className="px-4 py-8 text-center text-sm text-muted">You are all caught up.</li> : null}
            {items.map((n) => {
              const body = (
                <div className="flex gap-3">
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      n.read_at ? "bg-transparent" : n.severity === "critical" ? "bg-danger" : n.severity === "warning" ? "bg-warning" : "bg-primary",
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className={cn("text-sm", n.read_at ? "text-muted" : "font-medium text-fg")}>{n.title}</p>
                    {n.body ? <p className="line-clamp-2 text-xs text-muted">{n.body}</p> : null}
                    <p className="mt-0.5 text-[11px] text-muted">{fmtAgo(n.created_at)}</p>
                  </div>
                </div>
              );
              return (
                <li key={n.id} className="border-b border-border last:border-0">
                  {n.link ? (
                    <Link href={n.link} onClick={() => markRead(n.id)} className="block px-4 py-3 hover:bg-surface-2">
                      {body}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => markRead(n.id)} className="block w-full px-4 py-3 text-left hover:bg-surface-2">
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
