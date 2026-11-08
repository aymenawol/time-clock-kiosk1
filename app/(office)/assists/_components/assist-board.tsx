"use client";

import { Accessibility, Check, MessageSquare } from "lucide-react";
import { useState } from "react";
import { Age, SlaTimer } from "@/components/ops/timers";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { useAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";
import { fmtTime, fullName } from "@/lib/format";
import { acknowledgeAssist, resolveAssist } from "../actions";

interface Name {
  first_name: string;
  last_name: string;
}

export interface AssistItem {
  id: string;
  status: string;
  created_at: string;
  escalated_at: string | null;
  responded_at: string | null;
  resolved_at: string | null;
  response: string | null;
  notes: string | null;
  passenger_name: string;
  flight_number: string | null;
  assist_type: string;
  passenger_count: number;
  employee: Name | null;
  responder: Name | null;
  vehicle: { number: string } | null;
  airline: { name: string; iata_code: string | null } | null;
  location: { name: string; code: string } | null;
}

const STATUS: Record<string, { label: string; tone: Tone; card: string }> = {
  pending: { label: "Pending", tone: "warning", card: "border-warning/40 bg-warning-soft/40" },
  escalated: { label: "Escalated", tone: "danger", card: "border-danger/50 bg-danger-soft/50" },
  acknowledged: { label: "Acknowledged", tone: "info", card: "border-info/40 bg-info-soft/40" },
  resolved: { label: "Resolved", tone: "success", card: "border-border bg-surface" },
};
const TYPE_LABEL: Record<string, string> = {
  wheelchair: "Wheelchair",
  medical: "Medical",
  unaccompanied: "Unaccompanied minor",
  other: "Other",
};

interface Ctx {
  serverNow: number;
  timeZone: string;
  clock24h: boolean;
  escalationMinutes: number;
}

export function AssistBoard({ active, resolved, ...ctx }: { active: AssistItem[]; resolved: AssistItem[] } & Ctx) {
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="assist-active">
        <div className="mb-3 flex items-center gap-2">
          {active.length ? (
            <span className="relative flex size-2.5" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-warning opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-warning" />
            </span>
          ) : null}
          <h2 id="assist-active" className="text-base font-semibold">
            Active ({active.length})
          </h2>
        </div>
        {active.length === 0 ? (
          <Card>
            <EmptyState icon={Accessibility} title="No open assist requests" description="New requests from drivers appear here instantly." />
          </Card>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {active.map((r) => (
              <li key={r.id}>
                <AssistCard item={r} {...ctx} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card>
        <CardHeader title={`Resolved today (${resolved.length})`} />
        {resolved.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">Nothing resolved yet today.</p>
        ) : (
          <ul className="divide-y divide-border">
            {resolved.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="font-medium">{r.passenger_name}</span>
                <span className="text-muted">
                  {r.airline?.name ?? "No airline"}
                  {r.flight_number ? ` · Flight ${r.flight_number}` : ""} · {fullName(r.employee)}
                </span>
                <span className="tabular ml-auto text-xs text-muted">
                  {fmtTime(r.created_at, ctx.timeZone, ctx.clock24h)} to {fmtTime(r.resolved_at, ctx.timeZone, ctx.clock24h)}
                  {r.responder ? ` · ${fullName(r.responder)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function AssistCard({ item: r, serverNow, timeZone, clock24h, escalationMinutes }: { item: AssistItem } & Ctx) {
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const [ack, acking] = useAction(acknowledgeAssist, {
    success: "Reply sent to the driver",
    onSuccess: () => {
      setReplying(false);
      setText("");
    },
  });
  const [resolve, resolving] = useAction(resolveAssist, { success: "Marked resolved" });
  const st = STATUS[r.status] ?? STATUS.pending;

  return (
    <article className={cn("rounded-[var(--radius-card)] border p-4", st.card)} aria-label={`Assist request for ${r.passenger_name}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{r.passenger_name}</p>
          <p className="mt-0.5 text-sm text-muted">
            {r.airline?.name ?? "No airline"}
            {r.flight_number ? ` · Flight ${r.flight_number}` : ""} · Bus {r.vehicle?.number ?? "N/A"}
          </p>
          <p className="text-sm text-muted">
            {TYPE_LABEL[r.assist_type] ?? r.assist_type}
            {r.passenger_count > 1 ? ` · ${r.passenger_count} passengers` : ""}
            {r.location ? ` · ${r.location.code}` : ""}
          </p>
          <p className="text-sm text-muted">Driver: {fullName(r.employee)}</p>
          <p className="tabular text-xs text-muted">
            Requested {fmtTime(r.created_at, timeZone, clock24h)} · <Age at={r.created_at} serverNow={serverNow} suffix=" ago" />
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge tone={st.tone} dot>
            {st.label}
          </Badge>
          {r.status === "pending" ? (
            <SlaTimer createdAt={r.created_at} minutes={escalationMinutes} serverNow={serverNow} className="text-sm" />
          ) : null}
          {r.status === "escalated" && r.escalated_at ? (
            <span className="text-xs font-medium text-danger">
              Escalated <Age at={r.escalated_at} serverNow={serverNow} suffix=" ago" />
            </span>
          ) : null}
        </div>
      </div>

      {r.notes ? <p className="mt-2 rounded bg-surface/70 px-2 py-1 text-sm">{r.notes}</p> : null}
      {r.response ? (
        <p className="mt-2 flex items-start gap-2 rounded bg-surface/70 px-2 py-1 text-sm">
          <MessageSquare className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
          <span>
            {r.response}
            {r.responder ? <span className="text-muted"> ({fullName(r.responder)})</span> : null}
          </span>
        </p>
      ) : null}

      {replying ? (
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void ack({ id: r.id, response: text });
          }}
        >
          <label className="sr-only" htmlFor={`reply-${r.id}`}>
            Reply to the driver
          </label>
          <Input
            id={`reply-${r.id}`}
            autoFocus
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            placeholder="Reply to the driver, e.g. agent meeting you at door 4"
            className="min-w-0 flex-1"
          />
          <Button type="submit" loading={acking} disabled={!text.trim()}>
            Send
          </Button>
          <Button type="button" variant="ghost" onClick={() => setReplying(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setReplying(true)}>
            <MessageSquare />
            {r.status === "acknowledged" ? "Update reply" : "Acknowledge"}
          </Button>
          <Button variant="success" size="sm" loading={resolving} onClick={() => void resolve({ id: r.id })}>
            <Check />
            Resolve
          </Button>
        </div>
      )}
    </article>
  );
}
