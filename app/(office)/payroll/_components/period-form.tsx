"use client";

import { Plus } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { createPeriod } from "../actions";

export function PeriodForm({ suggested }: { suggested: { startsOn: string; endsOn: string; payDate: string } }) {
  const [open, setOpen] = React.useState(false);
  const [run, pending, errors] = useAction(createPeriod, { success: "Pay period created", onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> New period
      </Button>
      <DialogContent title="Create pay period" description="Suggested: the next 14 days after the last period. Periods can't overlap.">
        <form
          className="flex flex-col gap-4 overflow-y-auto p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void run({
              starts_on: String(fd.get("period_start") ?? ""),
              ends_on: String(fd.get("period_end") ?? ""),
              pay_date: String(fd.get("pay_date") ?? ""),
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Period start" htmlFor="period_start" error={errors.starts_on?.[0]}>
              <Input id="period_start" name="period_start" type="date" defaultValue={suggested.startsOn} required />
            </Field>
            <Field label="Period end" htmlFor="period_end" error={errors.ends_on?.[0]}>
              <Input id="period_end" name="period_end" type="date" defaultValue={suggested.endsOn} required />
            </Field>
            <Field label="Pay date" htmlFor="pay_date" error={errors.pay_date?.[0]}>
              <Input id="pay_date" name="pay_date" type="date" defaultValue={suggested.payDate} required />
            </Field>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="success" loading={pending}>
              Create period
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
