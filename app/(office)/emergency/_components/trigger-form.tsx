"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";
import { triggerEmergency } from "../actions";
import { KIND_LABEL } from "./labels";

type Kind = keyof typeof KIND_LABEL;

export function TriggerForm({ audience }: { audience: number }) {
  const [kind, setKind] = useState<Kind>("custom");
  const [title, setTitle] = useState<string>(KIND_LABEL.custom);
  const [titleEdited, setTitleEdited] = useState(false);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [run, pending, fieldErrors] = useAction(triggerEmergency, {
    success: "Emergency alert sent",
    onSuccess: () => {
      setOpen(false);
      setMessage("");
    },
  });

  const pick = (k: Kind) => {
    setKind(k);
    if (!titleEdited) setTitle(KIND_LABEL[k]);
  };
  const ready = message.trim().length > 0 && title.trim().length > 0;

  return (
    <Card>
      <CardHeader title="Trigger emergency alert" description="Everyone on the team sees a full-screen alert and must acknowledge it." />
      <CardBody className="flex flex-col gap-4">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Event type</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Event type">
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => pick(k)}
                className={cn(
                  "min-h-11 rounded-[var(--radius-control)] border px-4 py-2 text-sm font-medium transition-colors",
                  kind === k ? "border-danger bg-danger text-white" : "border-border bg-surface text-fg hover:bg-surface-2",
                )}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </fieldset>
        <Field label="Title" htmlFor="em-title" error={fieldErrors.title?.[0]}>
          <Input
            id="em-title"
            value={title}
            maxLength={120}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleEdited(true);
            }}
          />
        </Field>
        <Field label="Message" htmlFor="em-message" hint="Describe the situation and the actions people must take." error={fieldErrors.message?.[0]}>
          <Textarea id="em-message" rows={4} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="danger" size="lg" disabled={!ready} className="w-full">
              <AlertTriangle />
              Trigger emergency alert
            </Button>
          </DialogTrigger>
          <DialogContent title="Send this emergency alert?" description={`About ${audience} active employee${audience === 1 ? "" : "s"} will be alerted right away. This can't be unsent.`}>
            <div className="rounded-[var(--radius-control)] bg-danger-soft p-3 text-sm">
              <p className="font-semibold text-danger">
                {KIND_LABEL[kind]}: {title}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{message}</p>
            </div>
            <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button variant="danger" loading={pending} onClick={() => void run({ kind, title, message })}>
                Yes, send alert
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardBody>
    </Card>
  );
}
