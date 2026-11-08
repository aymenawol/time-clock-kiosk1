"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { createCycle, updateCycle } from "../actions";

export interface CycleFormValues {
  name: string;
  description: string;
  starts_on: string;
  ends_on: string;
  opens_at: string;
  closes_at: string;
  max_choices: number;
}

export function CycleForm({
  initial,
  id,
  timeZone,
}: {
  initial: CycleFormValues;
  /** Edit this cycle; create a new one when omitted. */
  id?: string;
  timeZone: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState(initial);
  const [create, creating, createErrors] = useAction(createCycle, {
    success: "Bid cycle created",
    onSuccess: (d) => {
      setOpen(false);
      router.push(`/bids/${d.id}`);
    },
  });
  const [update, updating, updateErrors] = useAction(updateCycle, {
    success: "Saved",
    onSuccess: () => setOpen(false),
  });
  const errors = id ? updateErrors : createErrors;
  const err = (k: keyof CycleFormValues) => errors[k]?.[0];
  const set = <K extends keyof CycleFormValues>(k: K, value: CycleFormValues[K]) => setV((p) => ({ ...p, [k]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (id) await update({ id, ...v });
    else await create(v);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setV(initial);
        setOpen(o);
      }}
    >
      {id ? (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <Pencil aria-hidden />
          Edit details
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus aria-hidden />
          New bid cycle
        </Button>
      )}
      <DialogContent
        title={id ? "Edit bid cycle" : "New bid cycle"}
        description={`Times are in ${timeZone}.`}
        className="max-w-xl"
      >
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Name" htmlFor="bc-name" error={err("name")} className="sm:col-span-2">
            <Input id="bc-name" value={v.name} maxLength={120} onChange={(e) => set("name", e.target.value)} placeholder="Winter 2027 shift bid" />
          </Field>
          <Field label="Description (optional)" htmlFor="bc-desc" error={err("description")} className="sm:col-span-2">
            <Textarea id="bc-desc" value={v.description} maxLength={2000} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field label="Schedule starts" htmlFor="bc-start" error={err("starts_on")}>
            <Input id="bc-start" type="date" value={v.starts_on} onChange={(e) => set("starts_on", e.target.value)} />
          </Field>
          <Field label="Schedule ends" htmlFor="bc-end" error={err("ends_on")}>
            <Input id="bc-end" type="date" value={v.ends_on} onChange={(e) => set("ends_on", e.target.value)} />
          </Field>
          <Field label="Bidding opens" htmlFor="bc-opens" error={err("opens_at")}>
            <Input id="bc-opens" type="datetime-local" value={v.opens_at} onChange={(e) => set("opens_at", e.target.value)} />
          </Field>
          <Field label="Bidding closes" htmlFor="bc-closes" error={err("closes_at")}>
            <Input id="bc-closes" type="datetime-local" value={v.closes_at} onChange={(e) => set("closes_at", e.target.value)} />
          </Field>
          <Field
            label="Choices per employee"
            htmlFor="bc-max"
            hint="How many lines each employee can rank (1 to 10)."
            error={err("max_choices")}
          >
            <Input
              id="bc-max"
              type="number"
              min={1}
              max={10}
              value={v.max_choices}
              onChange={(e) => set("max_choices", Number(e.target.value))}
              className="tabular"
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:col-span-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={creating || updating}>
              {id ? "Save" : "Create cycle"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
