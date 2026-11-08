"use client";

import { useRouter } from "next/navigation";
import { markAllNotificationsRead, markNotificationRead } from "@/app/m/notifications/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";

export interface NotificationView {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  severity: string;
  unread: boolean;
  when: string;
}

const TONE = { info: "info", warning: "warning", critical: "danger" } as const;

export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const [run, pending] = useAction(markAllNotificationsRead, { success: "All marked as read" });
  return (
    <Button variant="secondary" size="lg" disabled={disabled} loading={pending} onClick={() => void run({})}>
      Mark all read
    </Button>
  );
}

export function NotificationList({ items }: { items: NotificationView[] }) {
  const router = useRouter();
  const [markRead, pending] = useAction(markNotificationRead, { refresh: true });

  return (
    <ul className="flex flex-col gap-2">
      {items.map((n) => (
        <li key={n.id} className={cn("rounded-[var(--radius-card)] border p-4", n.unread ? "border-primary bg-primary-soft" : "border-border bg-surface")}>
          <div className="flex items-start justify-between gap-2">
            <p className={cn("min-w-0 break-words", n.unread ? "font-semibold" : "font-medium")}>{n.title}</p>
            {n.severity !== "info" ? <Badge tone={TONE[n.severity as keyof typeof TONE] ?? "neutral"}>{n.severity === "critical" ? "Urgent" : "Warning"}</Badge> : null}
          </div>
          {n.body ? <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">{n.body}</p> : null}
          <p className="mt-1 text-xs text-muted">{n.when}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {n.link ? (
              <Button
                size="lg"
                variant="secondary"
                onClick={async () => {
                  if (n.unread) await markRead({ id: n.id });
                  router.push(n.link as string);
                }}
              >
                Open
              </Button>
            ) : null}
            {n.unread ? (
              <Button size="lg" variant="ghost" disabled={pending} onClick={() => void markRead({ id: n.id })}>
                Mark read
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
