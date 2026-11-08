"use client";

import { Plus } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { OFFER_ROLES } from "../_lib/roles";
import { postOffer } from "../actions";

/** Post a shift: v0 fields (date, start time, duration hours, slots, bid close, description) plus eligible roles. */
export function OfferForm({ defaultDate }: { defaultDate: string }) {
  const [open, setOpen] = React.useState(false);
  const [roles, setRoles] = React.useState<string[]>(["driver"]);
  const [exec, pending, errors] = useAction(postOffer, { success: "Overtime posted", onSuccess: () => setOpen(false) });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const date = String(fd.get("date") ?? "");
    const time = String(fd.get("start_time") ?? "");
    const closes = String(fd.get("bid_close_at") ?? "");
    const hours = Number(fd.get("duration_hours"));
    const startsAt = date && time ? `${date}T${time}` : "";
    await exec({
      starts_at: startsAt,
      duration_minutes: Math.round(hours * 60),
      slots: Number(fd.get("slots_available") || 1),
      description: String(fd.get("description") ?? ""),
      // v0 left "Bid Close At" optional: bidding then closes when the shift starts.
      bid_closes_at: closes || startsAt,
      eligible_roles: roles as never,
    });
  }

  const err = (k: string) => errors[k]?.[0];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Post shift
      </Button>
      <DialogContent title="Post overtime shift" description="Eligible employees can bid from their phones." className="max-w-xl">
        <form onSubmit={submit} className="flex flex-col gap-4 overflow-y-auto p-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date *" htmlFor="ot-date" error={err("starts_at")}>
              <Input id="ot-date" name="date" type="date" defaultValue={defaultDate} required />
            </Field>
            <Field label="Start time *" htmlFor="ot-start">
              <Input id="ot-start" name="start_time" type="time" required />
            </Field>
            <Field label="Duration (hours) *" htmlFor="ot-duration" error={err("duration_minutes")}>
              <Input id="ot-duration" name="duration_hours" type="number" step="0.5" min="0.5" max="16" required />
            </Field>
            <Field label="Slots available" htmlFor="ot-slots" error={err("slots")}>
              <Input id="ot-slots" name="slots_available" type="number" min="1" defaultValue={1} />
            </Field>
            <Field
              label="Bid close at"
              htmlFor="ot-close"
              hint="Leave empty to close bidding when the shift starts."
              error={err("bid_closes_at")}
            >
              <Input id="ot-close" name="bid_close_at" type="datetime-local" />
            </Field>
            <Field label="Description" htmlFor="ot-desc" error={err("description")}>
              <Textarea id="ot-desc" name="description" rows={2} required />
            </Field>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-fg">Who can bid</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {OFFER_ROLES.map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={roles.includes(r.value)}
                    onChange={(e) => setRoles((p) => (e.target.checked ? [...p, r.value] : p.filter((x) => x !== r.value)))}
                  />
                  {r.label}
                </label>
              ))}
            </div>
            {err("eligible_roles") ? (
              <p className="mt-1 text-xs text-danger" role="alert">
                {err("eligible_roles")}
              </p>
            ) : null}
          </fieldset>
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="success" loading={pending}>
              Post shift
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
