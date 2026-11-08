"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useState } from "react";
import { submitBids } from "@/app/m/bids/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/ui/use-action";

export interface BidLineView {
  id: string;
  lineNumber: number;
  times: string;
  weekdays: string;
  type: string;
  capacity: number;
  route: string | null;
  notes: string | null;
}

function LineSummary({ line }: { line: BidLineView }) {
  return (
    <span className="min-w-0 text-left">
      <span className="block font-medium">
        Line {line.lineNumber} <span className="font-normal text-muted">{line.times}</span>
      </span>
      <span className="block text-sm text-muted">
        {line.weekdays} · {line.type} · {line.capacity} {line.capacity === 1 ? "spot" : "spots"}
        {line.route ? ` · ${line.route}` : ""}
      </span>
      {line.notes ? <span className="block text-xs text-muted">{line.notes}</span> : null}
    </span>
  );
}

export function BidPicker({
  cycleId,
  lines,
  maxChoices,
  initial,
}: {
  cycleId: string;
  lines: BidLineView[];
  maxChoices: number;
  initial: string[];
}) {
  const valid = new Set(lines.map((l) => l.id));
  const [picked, setPicked] = useState<string[]>(initial.filter((id) => valid.has(id)));
  const [run, pending] = useAction(submitBids, { success: "Your choices are saved" });
  const byId = new Map(lines.map((l) => [l.id, l]));
  const full = picked.length >= maxChoices;

  function move(index: number, delta: number) {
    setPicked((p) => {
      const next = [...p];
      const j = index + delta;
      if (j < 0 || j >= next.length) return p;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="my-choices">
        <h2 id="my-choices" className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          Your choices ({picked.length} of {maxChoices})
        </h2>
        {picked.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-dashed border-border-strong p-4 text-sm text-muted">
            Add lines from the list below. Your first choice is the one you want most.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {picked.map((id, i) => {
              const line = byId.get(id);
              if (!line) return null;
              return (
                <li key={id} className="flex items-center gap-2 rounded-[var(--radius-card)] border border-primary bg-primary-soft p-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-fg">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <LineSummary line={line} />
                  </div>
                  <div className="flex shrink-0">
                    <Button variant="ghost" size="icon" aria-label={`Move line ${line.lineNumber} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Move line ${line.lineNumber} down`} disabled={i === picked.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Remove line ${line.lineNumber}`} onClick={() => setPicked((p) => p.filter((x) => x !== id))}>
                      <X />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <Button size="xl" className="mt-3 w-full" disabled={picked.length === 0} loading={pending} onClick={() => void run({ cycleId, lineIds: picked })}>
          Save my choices
        </Button>
      </section>

      <section aria-labelledby="all-lines">
        <h2 id="all-lines" className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          Lines
        </h2>
        <ul className="flex flex-col gap-2">
          {lines.map((line) => {
            const on = picked.includes(line.id);
            return (
              <li key={line.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3">
                <LineSummary line={line} />
                {on ? (
                  <Badge tone="primary">Choice {picked.indexOf(line.id) + 1}</Badge>
                ) : (
                  <Button variant="secondary" size="lg" disabled={full} onClick={() => setPicked((p) => [...p, line.id])} aria-label={`Add line ${line.lineNumber}`}>
                    <Plus /> Add
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
