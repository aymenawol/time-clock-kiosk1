"use client";

import { Plus } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { pairKiosk } from "../actions";

interface Issued {
  code: string;
  name: string;
  expiresAt: string;
}

export function PairKiosk({ timeZone, clock24h }: { timeZone: string; clock24h: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [issued, setIssued] = React.useState<Issued | null>(null);
  const [run, pending, errors] = useAction(pairKiosk, { onSuccess: (d) => setIssued(d) });

  function onOpenChange(v: boolean) {
    setOpen(v);
    if (v) {
      setName("");
      setIssued(null);
    }
  }

  const expires = issued
    ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: !clock24h, timeZone }).format(new Date(issued.expiresAt))
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button type="button" size="sm" onClick={() => onOpenChange(true)}>
        <Plus aria-hidden /> Pair a new kiosk
      </Button>
      <DialogContent
        title={issued ? "Pairing code" : "Pair a new kiosk"}
        description={issued ? undefined : "Name the tablet. You get a one-time code to enter on it."}
      >
        {issued ? (
          <div className="flex flex-col gap-4 p-5">
            <p className="text-sm text-muted">
              Open <span className="font-mono text-fg">/kiosk</span> on the tablet for <span className="font-medium text-fg">{issued.name}</span> and enter this
              code.
            </p>
            <p
              className="rounded-[var(--radius-card)] bg-surface-2 py-5 text-center font-mono text-4xl font-semibold tracking-widest text-fg"
              aria-label={`Pairing code ${issued.code.split("").join(" ")}`}
            >
              {issued.code}
            </p>
            <p className="text-sm text-muted">The code works once and expires at {expires}. If it expires, make a new one.</p>
            <div className="flex justify-end">
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void run({ name });
            }}
          >
            <Field label="Kiosk name" htmlFor="kiosk-name" error={errors.name?.[0]} hint="For example Terminal 1 break room.">
              <Input id="kiosk-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />
            </Field>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                Create code
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
