import type { BreakKind, BreakStatus } from "@/lib/supabase/types";

export interface BreakRow {
  id: string;
  kind: BreakKind;
  paid: boolean;
  sequence: number;
  planned_minutes: number;
  window_start: string | null;
  window_end: string | null;
  started_at: string | null;
  ended_at: string | null;
  status: BreakStatus;
}

export const BREAK_KIND_LABEL: Record<BreakKind, string> = { rest: "Rest", meal: "Meal" };

const ts = (s: string | null) => (s ? new Date(s).getTime() : Number.POSITIVE_INFINITY);

/** Break picture for one shift: what's running, what's next, what was missed. */
export function breakState<B extends BreakRow>(breaks: B[], now: number) {
  const sorted = [...breaks].sort((a, b) => ts(a.window_start) - ts(b.window_start) || a.sequence - b.sequence);
  const current = sorted.find((b) => b.started_at && !b.ended_at) ?? null;
  const upcoming = sorted.filter((b) => b.status === "planned" && !b.started_at);
  const next = upcoming[0] ?? null;
  const windowOpen =
    next !== null &&
    next.window_start !== null &&
    new Date(next.window_start).getTime() <= now &&
    (next.window_end === null || new Date(next.window_end).getTime() >= now);
  const missed = sorted.filter((b) => b.status === "missed" && !b.started_at);
  const overrun = sorted.filter((b) => b.status === "overrun");
  const taken = sorted.filter((b) => b.started_at && b.ended_at).length;
  return { sorted, current, next, windowOpen, missed, overrun, taken, total: sorted.length };
}
