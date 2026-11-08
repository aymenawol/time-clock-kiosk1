"use client";

import { Check, CornerUpRight, HeartPulse } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { useAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";
import { dismissAlert, resolveAlert } from "../actions";

export interface AlertView {
  id: string;
  employeeName: string;
  employeeId: string;
  kind: string;
  severity: string;
  status: "open" | "resolved" | "dismissed";
  message: string;
  triggeredLabel: string;
  closedLabel: string | null;
  note: string | null;
  closedBy: string | null;
}

export const KIND_LABEL: Record<string, string> = {
  long_shift: "Long shift",
  on_duty_limit: "On-duty limit",
  short_rest: "Short rest",
  consecutive_days: "Consecutive days",
  weekly_hours: "Weekly hours",
  weekly_overtime: "Weekly overtime",
};

type StatusFilter = "open" | "all" | "closed";

export function FatigueList({ alerts }: { alerts: AlertView[] }) {
  const [status, setStatus] = React.useState<StatusFilter>("open");
  const [kind, setKind] = React.useState("all");
  const [target, setTarget] = React.useState<{ alert: AlertView; mode: "resolve" | "dismiss" } | null>(null);
  const [note, setNote] = React.useState("");
  const [doResolve, resolving, resolveErrors] = useAction(resolveAlert, { success: "Alert resolved", onSuccess: () => setTarget(null) });
  const [doDismiss, dismissing, dismissErrors] = useAction(dismissAlert, { success: "Alert dismissed", onSuccess: () => setTarget(null) });

  const kinds = Array.from(new Set(alerts.map((a) => a.kind)));
  const filtered = alerts.filter((a) => {
    if (status === "open" && a.status !== "open") return false;
    if (status === "closed" && a.status === "open") return false;
    if (kind !== "all" && a.kind !== kind) return false;
    return true;
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    if (target.mode === "resolve") void doResolve({ id: target.alert.id, note });
    else void doDismiss({ id: target.alert.id, reason: note });
  }
  const errors = target?.mode === "resolve" ? resolveErrors : dismissErrors;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
        {(
          [
            ["open", "Unresolved"],
            ["all", "All"],
            ["closed", "Resolved or dismissed"],
          ] as const
        ).map(([v, label]) => (
          <Button key={v} size="sm" variant={status === v ? "primary" : "secondary"} aria-pressed={status === v} onClick={() => setStatus(v)}>
            {label}
          </Button>
        ))}
        <span className="mx-1 hidden h-6 border-l border-border sm:block" aria-hidden />
        {["all", ...kinds].map((k) => (
          <Button key={k} size="sm" variant={kind === k ? "primary" : "secondary"} aria-pressed={kind === k} onClick={() => setKind(k)}>
            {k === "all" ? "All types" : (KIND_LABEL[k] ?? k)}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface">
          <EmptyState icon={HeartPulse} title="No fatigue alerts match these filters" description="Alerts are raised automatically from time records." />
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((a) => {
            const open = a.status === "open";
            return (
              <li
                key={a.id}
                className={cn(
                  "rounded-[var(--radius-card)] border p-4",
                  open ? (a.severity === "critical" ? "border-danger/40 bg-danger-soft" : "border-warning/40 bg-warning-soft") : "border-border bg-surface opacity-75",
                )}
              >
                <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <a href={`/people/${a.employeeId}`} className="font-semibold text-fg hover:underline">
                        {a.employeeName}
                      </a>
                      <Badge tone={a.severity === "critical" ? "danger" : "warning"}>{KIND_LABEL[a.kind] ?? a.kind}</Badge>
                      {a.status === "resolved" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-success">
                          <Check className="size-3.5" aria-hidden /> Resolved
                        </span>
                      ) : null}
                      {a.status === "dismissed" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-warning">
                          <CornerUpRight className="size-3.5" aria-hidden /> Dismissed
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-fg">{a.message}</p>
                    <p className="mt-1 text-xs text-muted">Triggered {a.triggeredLabel}</p>
                    {a.status === "resolved" && a.note ? (
                      <p className="mt-1 text-xs text-muted">
                        Resolution: {a.note}
                        {a.closedBy ? ` (${a.closedBy}, ${a.closedLabel})` : ""}
                      </p>
                    ) : null}
                    {a.status === "dismissed" && a.note ? (
                      <p className="mt-1 text-xs text-muted">
                        Dismissed: {a.note}
                        {a.closedBy ? ` (${a.closedBy}, ${a.closedLabel})` : ""}
                      </p>
                    ) : null}
                  </div>
                  {open ? (
                    <div className="flex shrink-0 flex-row gap-2 sm:flex-col">
                      <Button size="sm" variant="success" onClick={() => (setNote(""), setTarget({ alert: a, mode: "resolve" }))}>
                        Resolve
                      </Button>
                      <Button size="sm" variant="warning" onClick={() => (setNote(""), setTarget({ alert: a, mode: "dismiss" }))}>
                        Dismiss
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={target !== null} onOpenChange={(v) => !v && setTarget(null)}>
        <DialogContent
          title={target?.mode === "resolve" ? "Resolve alert" : "Dismiss alert"}
          description={target ? `${target.alert.employeeName}: ${KIND_LABEL[target.alert.kind] ?? target.alert.kind}` : undefined}
        >
          <form onSubmit={submit} className="flex flex-col gap-4 p-5">
            <Field
              label={target?.mode === "resolve" ? "Resolution notes" : "Reason for dismissal"}
              htmlFor="fatigue-note"
              error={errors.note?.[0] ?? errors.reason?.[0]}
            >
              <Textarea
                id="fatigue-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                required
                placeholder={target?.mode === "resolve" ? "What was done about it?" : "Why is no action needed?"}
              />
            </Field>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" variant={target?.mode === "resolve" ? "success" : "warning"} loading={resolving || dismissing}>
                {target?.mode === "resolve" ? "Mark resolved" : "Dismiss"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
