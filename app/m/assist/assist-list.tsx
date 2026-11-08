"use client";

import { PhoneCall, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";
import { ASSIST_STATUS } from "../_components/driver-tasks";
import { cancelAssist } from "./actions";

export interface AssistItem {
  id: string;
  passengerName: string;
  flight: string | null;
  status: string;
  response: string | null;
  airline: string | null;
  sentAt: string;
}

export function AssistList({ items, escalationMinutes }: { items: AssistItem[]; escalationMinutes: number }) {
  const [run, pending] = useAction(cancelAssist, { success: "Request cancelled" });
  return (
    <Card>
      <CardHeader title="Today's requests" description={`${items.length} sent today`} />
      <ul className="divide-y divide-border">
        {items.map((a) => {
          const s = ASSIST_STATUS[a.status] ?? ASSIST_STATUS.pending;
          const cancellable = a.status === "pending" || a.status === "escalated";
          return (
            <li key={a.id} className={cn("px-4 py-3", a.status === "escalated" && "bg-danger-soft")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-fg">{a.passengerName}</p>
                  <p className="text-sm text-muted">
                    {[a.airline, a.flight ? `Flight ${a.flight}` : null, `Sent ${a.sentAt}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Badge tone={s.tone} dot>
                  {s.label}
                </Badge>
              </div>
              {a.response ? <p className="mt-1 text-sm text-fg">Dispatch: {a.response}</p> : null}
              {a.status === "escalated" ? (
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-danger" role="alert">
                  <PhoneCall className="size-4" aria-hidden /> No answer in {escalationMinutes} min. Call dispatch directly.
                </p>
              ) : a.status === "pending" ? (
                <p className="mt-1 text-xs text-muted">
                  Escalates after {escalationMinutes} minute{escalationMinutes === 1 ? "" : "s"} without an answer.
                </p>
              ) : null}
              {cancellable ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="mt-2 w-full"
                  disabled={pending}
                  onClick={() => void run({ id: a.id })}
                >
                  <X /> Cancel request
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
