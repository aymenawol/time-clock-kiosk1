"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { fmtAge, fmtClock } from "./time";

// One shared one-second ticker for every live timer on the page.
let listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let current = 0;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      for (const l of listeners) l();
    }, 1000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
      listeners = new Set();
    }
  };
}

const getSnapshot = () => {
  if (!current) current = Date.now();
  return current;
};
const getServerSnapshot = () => 0;

/**
 * The current time in ms, ticking every second. Renders `serverNow` during
 * SSR and hydration so the markup matches, then switches to the live clock.
 */
export function useNow(serverNow: number): number {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return now || serverNow;
}

/** "12s", "4m", "1h 05m" since a timestamp, with an optional stale tone. */
export function Age({
  at,
  serverNow,
  staleAfterMs,
  suffix = "",
  className,
}: {
  at: string | null | undefined;
  serverNow: number;
  staleAfterMs?: number;
  suffix?: string;
  className?: string;
}) {
  const now = useNow(serverNow);
  if (!at) return <span className={cn("text-muted", className)}>-</span>;
  const ms = now - new Date(at).getTime();
  const stale = staleAfterMs !== undefined && ms > staleAfterMs;
  return (
    <span className={cn("tabular", stale && "text-warning", className)}>
      {fmtAge(ms)}
      {suffix}
    </span>
  );
}

/** mm:ss elapsed since a timestamp. Turns warning past `warnAfterMs`. */
export function Elapsed({
  since,
  serverNow,
  warnAfterMs,
  className,
}: {
  since: string;
  serverNow: number;
  warnAfterMs?: number;
  className?: string;
}) {
  const now = useNow(serverNow);
  const ms = now - new Date(since).getTime();
  return (
    <span className={cn("tabular", warnAfterMs !== undefined && ms > warnAfterMs && "font-medium text-danger", className)}>
      {fmtClock(ms)}
    </span>
  );
}

/**
 * Assist SLA: counts down to `createdAt + minutes`; once past it shows how
 * long it has been overdue. Resolved or acknowledged requests show nothing.
 */
export function SlaTimer({
  createdAt,
  minutes,
  serverNow,
  className,
}: {
  createdAt: string;
  minutes: number;
  serverNow: number;
  className?: string;
}) {
  const now = useNow(serverNow);
  const deadline = new Date(createdAt).getTime() + minutes * 60_000;
  const left = deadline - now;
  if (left <= 0) {
    return (
      <span className={cn("tabular font-semibold text-danger", className)} title="Past the response target">
        Overdue {fmtAge(-left)}
      </span>
    );
  }
  return (
    <span
      className={cn("tabular font-medium", left < 60_000 ? "text-danger" : left < 120_000 ? "text-warning" : "text-fg", className)}
      title="Time left to respond"
    >
      {fmtClock(left)} left
    </span>
  );
}

/** A live wall clock in the organization time zone. */
export function LiveClock({
  serverNow,
  timeZone,
  clock24h,
  className,
}: {
  serverNow: number;
  timeZone: string;
  clock24h: boolean;
  className?: string;
}) {
  const now = useNow(serverNow);
  const text = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: !clock24h,
  }).format(new Date(now));
  return <span className={cn("font-mono tabular", className)}>{text}</span>;
}
