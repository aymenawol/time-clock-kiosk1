"use client";

import { fmtMinutes } from "@/lib/format";
import { useNow } from "./use-now";

/** "3h 12m" since an instant, updating live. */
export function Elapsed({ since, className }: { since: string; className?: string }) {
  const now = useNow();
  const minutes = now ? (now - new Date(since).getTime()) / 60_000 : null;
  return (
    <span className={className} suppressHydrationWarning>
      {minutes === null ? "--" : fmtMinutes(Math.floor(minutes))}
    </span>
  );
}

function mmss(totalSeconds: number) {
  const s = Math.abs(Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const core = `${String(m).padStart(h ? 2 : 1, "0")}:${String(r).padStart(2, "0")}`;
  return h ? `${h}:${core}` : core;
}

/**
 * Countdown to an instant ("12:04"), switching to "+1:30" once it has passed.
 * `render` lets the caller style the over/under states.
 */
export function Countdown({
  until,
  render,
}: {
  until: string | number;
  render: (text: string, over: boolean, secondsLeft: number) => React.ReactNode;
}) {
  const now = useNow();
  if (!now) return <>{render("--:--", false, Number.POSITIVE_INFINITY)}</>;
  const left = (new Date(until).getTime() - now) / 1000;
  return <>{render(left >= 0 ? mmss(left) : `+${mmss(left)}`, left < 0, left)}</>;
}
