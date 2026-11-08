"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { logLostItem, transitionLostItem } from "@/app/(office)/lost-found/actions";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";

export const LOST_STATUS: Record<string, { label: string; tone: Tone }> = {
  found: { label: "Found", tone: "info" },
  collected: { label: "Collected", tone: "primary" },
  at_dispatch: { label: "At dispatch", tone: "warning" },
  claimed: { label: "Claimed", tone: "success" },
  disposed: { label: "Disposed", tone: "neutral" },
};

export function LostStatusPill({ status }: { status: string }) {
  const s = LOST_STATUS[status] ?? { label: status, tone: "neutral" as Tone };
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

export interface LostItemView {
  id: string;
  reference: string;
  description: string;
  category: string;
  contents: string | null;
  status: string;
  foundAt: string;
  foundWhere: string;
  foundBy: string;
  custodyBy: string;
  claimant: string | null;
  disposalReason: string | null;
  photos: string[];
  events: { id: string; label: string; actor: string; at: string }[];
}

const NEXT: Record<string, { to: "collected" | "at_dispatch" | "claimed" | "disposed"; label: string }[]> = {
  found: [
    { to: "collected", label: "Mark collected" },
    { to: "at_dispatch", label: "Send to dispatch" },
    { to: "claimed", label: "Claimed" },
    { to: "disposed", label: "Dispose" },
  ],
  collected: [
    { to: "at_dispatch", label: "Send to dispatch" },
    { to: "claimed", label: "Claimed" },
    { to: "disposed", label: "Dispose" },
  ],
  at_dispatch: [
    { to: "claimed", label: "Claimed" },
    { to: "disposed", label: "Dispose" },
  ],
};

const txt = (v: FormDataEntryValue | null) => String(v ?? "").trim();

export function LostItemButton({ item }: { item: LostItemView }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"claimed" | "disposed" | null>(null);
  const [run, pending, errors] = useAction(transitionLostItem, {
    success: "Item updated",
    onSuccess: () => {
      setMode(null);
      setOpen(false);
    },
  });
  const options = NEXT[item.status] ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setMode(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          Open
        </Button>
      </DialogTrigger>
      <DialogContent title={`${item.reference}: ${item.description}`} className="max-w-xl">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <LostStatusPill status={item.status} />
            <Badge className="capitalize">{item.category}</Badge>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Found</dt>
              <dd>{item.foundAt}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Where</dt>
              <dd>{item.foundWhere}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Found by</dt>
              <dd>{item.foundBy}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">In custody of</dt>
              <dd>{item.custodyBy}</dd>
            </div>
            {item.claimant ? (
              <div className="col-span-2">
                <dt className="text-xs uppercase tracking-wide text-muted">Claimed by</dt>
                <dd>{item.claimant}</dd>
              </div>
            ) : null}
            {item.disposalReason ? (
              <div className="col-span-2">
                <dt className="text-xs uppercase tracking-wide text-muted">Disposal reason</dt>
                <dd>{item.disposalReason}</dd>
              </div>
            ) : null}
          </dl>
          {item.contents ? <p className="whitespace-pre-wrap rounded-[var(--radius-control)] bg-surface-2 p-3 text-sm">{item.contents}</p> : null}

          {item.photos.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {item.photos.map((src, i) => (
                <a key={i} href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[var(--radius-control)] border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Photo ${i + 1} of ${item.description}`} className="aspect-square w-full object-cover" loading="lazy" />
                </a>
              ))}
            </div>
          ) : null}

          <div>
            <h3 className="mb-1 text-sm font-semibold">History</h3>
            {item.events.length === 0 ? (
              <p className="text-sm text-muted">No status changes yet.</p>
            ) : (
              <ol className="flex flex-col gap-1 border-l border-border pl-3 text-sm">
                {item.events.map((e) => (
                  <li key={e.id}>
                    <span className="font-medium">{e.label}</span> <span className="text-muted">by {e.actor}, {e.at}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {options.length > 0 && mode === null ? (
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              {options.map((o) => (
                <Button
                  key={o.to}
                  variant={o.to === "disposed" ? "secondary" : o.to === "claimed" ? "success" : "primary"}
                  loading={pending}
                  onClick={() => (o.to === "claimed" || o.to === "disposed" ? setMode(o.to) : void run({ id: item.id, to: o.to }))}
                >
                  {o.label}
                </Button>
              ))}
            </div>
          ) : null}

          {mode === "claimed" ? (
            <form
              className="flex flex-col gap-3 border-t border-border pt-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await run({
                  id: item.id,
                  to: "claimed",
                  claimant_name: txt(f.get("name")),
                  claimant_contact: txt(f.get("contact")) || null,
                  claimant_id_last4: txt(f.get("last4")) || null,
                });
              }}
            >
              <Field label="Claimant name" htmlFor="lf-name" error={errors.claimant_name?.[0]}>
                <Input id="lf-name" name="name" required maxLength={120} />
              </Field>
              <Field label="Contact (optional)" htmlFor="lf-contact">
                <Input id="lf-contact" name="contact" maxLength={120} />
              </Field>
              <Field label="Last 4 of ID shown (optional)" htmlFor="lf-last4" error={errors.claimant_id_last4?.[0]}>
                <Input id="lf-last4" name="last4" maxLength={4} className="w-28" />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" variant="success" loading={pending}>
                  Confirm claim
                </Button>
                <Button type="button" variant="ghost" onClick={() => setMode(null)}>
                  Back
                </Button>
              </div>
            </form>
          ) : null}

          {mode === "disposed" ? (
            <form
              className="flex flex-col gap-3 border-t border-border pt-4"
              onSubmit={async (e) => {
                e.preventDefault();
                await run({ id: item.id, to: "disposed", disposal_reason: txt(new FormData(e.currentTarget).get("reason")) });
              }}
            >
              <Field label="Why is it being disposed of?" htmlFor="lf-reason" error={errors.disposal_reason?.[0]}>
                <Textarea id="lf-reason" name="reason" required maxLength={500} className="min-h-16" />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" variant="danger" loading={pending}>
                  Confirm disposal
                </Button>
                <Button type="button" variant="ghost" onClick={() => setMode(null)}>
                  Back
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LogLostItemButton({
  locations,
  vehicles,
}: {
  locations: { id: string; name: string }[];
  vehicles: { id: string; number: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [run, pending, errors] = useAction(logLostItem, {
    success: (d) => `Logged as ${d.reference}`,
    onSuccess: () => setOpen(false),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden />
          Log found item
        </Button>
      </DialogTrigger>
      <DialogContent title="Log a found item" description="A reference number is assigned automatically.">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await run({
              description: txt(f.get("description")),
              category: txt(f.get("category")) as "bag",
              contents: txt(f.get("contents")) || null,
              found_location_id: txt(f.get("location")) || null,
              found_vehicle_id: txt(f.get("vehicle")) || null,
            });
          }}
        >
          <Field label="What is it?" htmlFor="li-desc" error={errors.description?.[0]}>
            <Input id="li-desc" name="description" required maxLength={500} placeholder="Black backpack with a red tag" />
          </Field>
          <Field label="Category" htmlFor="li-cat">
            <Select id="li-cat" name="category" defaultValue="bag">
              <option value="bag">Bag</option>
              <option value="electronics">Electronics</option>
              <option value="document">Document</option>
              <option value="clothing">Clothing</option>
              <option value="jewelry">Jewelry</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Found at" htmlFor="li-loc">
              <Select id="li-loc" name="location" defaultValue="">
                <option value="">Not sure</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="On vehicle" htmlFor="li-veh">
              <Select id="li-veh" name="vehicle" defaultValue="">
                <option value="">None</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.number}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Contents or details (optional)" htmlFor="li-contents">
            <Textarea id="li-contents" name="contents" maxLength={2000} className="min-h-16" />
          </Field>
          <Button type="submit" loading={pending}>
            Log item
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
