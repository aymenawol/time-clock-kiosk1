"use client";

import { Coffee, TimerReset, Utensils } from "lucide-react";
import { BreakStatusPill } from "@/components/domain/status";
import { Countdown } from "@/components/field/ticker";
import { useNow } from "@/components/field/use-now";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";
import { fmtMinutes, fmtTime } from "@/lib/format";
import type { Break } from "@/lib/supabase/types";
import { endBreak, startBreak } from "./actions";

export type TimelineBreak = Pick<
  Break,
  "id" | "kind" | "sequence" | "paid" | "planned_minutes" | "window_start" | "window_end" | "started_at" | "ended_at" | "status"
>;

function breakName(b: TimelineBreak, all: TimelineBreak[]) {
  const base = b.kind === "rest" ? "Rest break" : "Meal break";
  const sameKind = all.filter((x) => x.kind === b.kind).length;
  return sameKind > 1 ? `${base} ${b.sequence}` : base;
}

function WindowHint({ b, tz, clock24h }: { b: TimelineBreak; tz: string; clock24h: boolean }) {
  const now = useNow();
  if (b.status !== "planned" || !b.window_start || !now) return null;
  const start = new Date(b.window_start).getTime();
  const end = b.window_end ? new Date(b.window_end).getTime() : null;
  if (now < start) {
    const mins = (start - now) / 60_000;
    return <span className="text-xs text-muted">{mins <= 60 ? `Opens in ${fmtMinutes(Math.ceil(mins))}` : `Opens ${fmtTime(start, tz, clock24h)}`}</span>;
  }
  if (end && now > end) return <Badge tone="danger">Window closed</Badge>;
  return (
    <Badge tone="warning" dot>
      Take it now{end ? ` · until ${fmtTime(end, tz, clock24h)}` : ""}
    </Badge>
  );
}

export function BreakTimeline({
  breaks,
  timeZone,
  clock24h,
  mealWaived,
}: {
  breaks: TimelineBreak[];
  timeZone: string;
  clock24h: boolean;
  mealWaived: boolean;
}) {
  const [runStart, starting] = useAction(startBreak, { success: "Break started" });
  const [runEnd, ending] = useAction(endBreak, { success: "Break ended. Welcome back." });
  const busy = starting || ending;

  const current = breaks.find((b) => b.started_at && !b.ended_at) ?? null;
  const hasMeal = breaks.some((b) => b.kind === "meal");
  const showMeal = hasMeal || !mealWaived;
  const fmt = (d: string | null) => fmtTime(d, timeZone, clock24h);

  return (
    <Card>
      <CardHeader
        title="Breaks"
        description={breaks.length ? `${breaks.filter((b) => b.ended_at).length} of ${breaks.length} taken` : "No breaks planned for this shift"}
      />
      {current ? (
        <div className="border-b border-border px-4 py-4" aria-live="polite">
          <Countdown
            until={new Date(current.started_at!).getTime() + current.planned_minutes * 60_000}
            render={(text, over) => (
              <div
                className={cn(
                  "rounded-[var(--radius-card)] px-4 py-4 text-center",
                  over ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary",
                )}
              >
                <p className="text-sm font-medium">
                  {breakName(current, breaks)} · {current.planned_minutes} min{current.paid ? " paid" : " unpaid"}
                </p>
                <p className="mt-1 font-mono text-5xl font-semibold tabular tracking-tight" suppressHydrationWarning>
                  {text}
                </p>
                <p className="mt-1 text-sm">
                  {over
                    ? "Your break is over. End it now."
                    : `Started ${fmt(current.started_at)} · ends ${fmt(
                        new Date(new Date(current.started_at!).getTime() + current.planned_minutes * 60_000).toISOString(),
                      )}`}
                </p>
              </div>
            )}
          />
          <Button size="xl" className="mt-3 w-full" loading={ending} disabled={busy} onClick={() => void runEnd({})}>
            <TimerReset /> End break
          </Button>
        </div>
      ) : null}

      {breaks.length ? (
        <ol className="divide-y divide-border">
          {breaks.map((b) => (
            <li key={b.id} className={cn("flex items-start gap-3 px-4 py-3", b.id === current?.id && "bg-surface-2")}>
              <span
                className={cn(
                  "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
                  b.ended_at ? "bg-success-soft text-success" : "bg-surface-2 text-muted",
                )}
                aria-hidden
              >
                {b.kind === "rest" ? <Coffee className="size-4" /> : <Utensils className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-fg">{breakName(b, breaks)}</p>
                  <span className="text-xs text-muted">
                    {b.planned_minutes} min · {b.paid ? "paid" : "unpaid"}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted tabular">
                  {b.started_at
                    ? `Taken ${fmt(b.started_at)}${b.ended_at ? ` – ${fmt(b.ended_at)}` : " – now"}`
                    : b.window_start
                      ? `Window ${fmt(b.window_start)} – ${fmt(b.window_end)}`
                      : "Any time during the shift"}
                </p>
                <div className="mt-1">
                  <WindowHint b={b} tz={timeZone} clock24h={clock24h} />
                </div>
              </div>
              <BreakStatusPill status={b.status} />
            </li>
          ))}
        </ol>
      ) : null}

      {!current ? (
        <div className={cn("grid grid-cols-1 gap-2 p-4", showMeal && "sm:grid-cols-2", breaks.length && "border-t border-border")}>
          <Button
            size="lg"
            variant="secondary"
            loading={starting}
            disabled={busy}
            onClick={() => void runStart({ kind: "rest" })}
          >
            <Coffee /> Start rest break
          </Button>
          {showMeal ? (
            <Button
              size="lg"
              variant="secondary"
              loading={starting}
              disabled={busy}
              onClick={() => void runStart({ kind: "meal" })}
            >
              <Utensils /> Start meal break
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
