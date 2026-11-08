import { Accessibility, CheckCircle2, ChevronRight, Circle, CircleDot, PhoneCall } from "lucide-react";
import Link from "next/link";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { fmtTime } from "@/lib/format";

export type TaskState = "done" | "draft" | "todo" | "blocked";

export interface DriverTask {
  href: string;
  label: string;
  state: TaskState;
  detail: string;
}

const ICON: Record<TaskState, React.ComponentType<{ className?: string }>> = {
  done: CheckCircle2,
  draft: CircleDot,
  todo: Circle,
  blocked: Circle,
};

export function DriverChecklist({ tasks }: { tasks: DriverTask[] }) {
  const done = tasks.filter((t) => t.state === "done").length;
  return (
    <Card>
      <CardHeader title="Today's checklist" description={`${done} of ${tasks.length} done`} />
      <ul className="divide-y divide-border">
        {tasks.map((t) => {
          const Icon = ICON[t.state];
          const inner = (
            <>
              <Icon
                className={cn(
                  "size-6 shrink-0",
                  t.state === "done" ? "text-success" : t.state === "draft" ? "text-warning" : "text-border-strong",
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className={cn("block font-medium", t.state === "blocked" ? "text-muted" : "text-fg")}>{t.label}</span>
                <span className="block text-sm text-muted">{t.detail}</span>
              </span>
              {t.state !== "blocked" ? <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden /> : null}
            </>
          );
          return (
            <li key={t.href}>
              {t.state === "blocked" ? (
                <div className="flex min-h-16 items-center gap-3 px-4 py-3" aria-disabled>
                  {inner}
                </div>
              ) : (
                <Link
                  href={t.href}
                  className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                >
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export const ASSIST_STATUS: Record<string, { label: string; tone: Tone; help: string }> = {
  pending: { label: "Waiting for dispatch", tone: "warning", help: "Dispatch has your request." },
  acknowledged: { label: "Dispatch is on it", tone: "primary", help: "Dispatch acknowledged your request." },
  escalated: { label: "No answer yet", tone: "danger", help: "Dispatch has not answered. Call dispatch directly." },
  resolved: { label: "Resolved", tone: "success", help: "This request is closed." },
  cancelled: { label: "Cancelled", tone: "neutral", help: "You cancelled this request." },
};

export interface OpenAssist {
  id: string;
  passenger_name: string;
  status: string;
  response: string | null;
  created_at: string;
  airline: { name: string } | null;
}

export function AssistSection({
  open,
  timeZone,
  clock24h,
}: {
  open: OpenAssist[];
  timeZone: string;
  clock24h: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {open.map((a) => {
        const s = ASSIST_STATUS[a.status] ?? ASSIST_STATUS.pending;
        return (
          <Link
            key={a.id}
            href="/m/assist"
            className={cn(
              "block rounded-[var(--radius-card)] border bg-surface px-4 py-3 transition-colors hover:bg-surface-2",
              a.status === "escalated" ? "border-danger" : "border-border",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Assist request</p>
              <Badge tone={s.tone} dot>
                {s.label}
              </Badge>
            </div>
            <p className="mt-1 font-medium text-fg">
              {a.passenger_name}
              {a.airline ? <span className="font-normal text-muted"> · {a.airline.name}</span> : null}
            </p>
            <p className="text-sm text-muted">
              Sent {fmtTime(a.created_at, timeZone, clock24h)}
              {a.response ? ` · "${a.response}"` : ""}
            </p>
            {a.status === "escalated" ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-danger" role="alert">
                <PhoneCall className="size-4" aria-hidden /> Call dispatch directly.
              </p>
            ) : null}
          </Link>
        );
      })}
      <Button asChild size="xl" variant="secondary" className="w-full">
        <Link href="/m/assist">
          <Accessibility /> Request assist
        </Link>
      </Button>
    </div>
  );
}
