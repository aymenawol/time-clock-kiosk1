"use client";

import { Megaphone, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox, Field, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";
import { saveOvertimeBanner, setOvertimeBannerActive } from "../actions";

export interface Banner {
  id: string;
  message: string;
  active: boolean;
  updated_at: string;
}

/** The overtime banner strip, plus an editor for dispatch. */
export function OvertimeBanner({ banners, canEdit, wall }: { banners: Banner[]; canEdit: boolean; wall?: boolean }) {
  const active = banners.find((b) => b.active) ?? null;
  if (!active && !canEdit) return null;
  if (!active) {
    return (
      <div className="mb-4 flex justify-end">
        <BannerEditor banners={banners} />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "mb-4 flex items-center gap-3 rounded-[var(--radius-card)] border border-accent/50 bg-accent-soft px-4 py-2.5",
        wall && "py-3 text-lg",
      )}
      role="status"
    >
      <Megaphone className={cn("size-5 shrink-0 text-warning", wall && "size-6")} aria-hidden />
      <p className="min-w-0 flex-1 font-medium text-fg">
        <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-warning">Overtime</span>
        {active.message}
      </p>
      {canEdit ? <BannerEditor banners={banners} /> : null}
    </div>
  );
}

function BannerEditor({ banners }: { banners: Banner[] }) {
  const [open, setOpen] = useState(false);
  const hasActive = banners.some((b) => b.active);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={hasActive ? "ghost" : "secondary"} size="sm">
          {hasActive ? <Pencil /> : <Plus />}
          {hasActive ? "Edit banner" : "Overtime banner"}
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Overtime banner"
        description="Shown on the dispatch board and on drivers' phones. Only one banner is shown at a time."
      >
        {open ? <BannerEditorBody banners={banners} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function BannerEditorBody({ banners }: { banners: Banner[] }) {
  const [editing, setEditing] = useState<Banner | null>(banners.find((b) => b.active) ?? null);
  const [message, setMessage] = useState(editing?.message ?? "");
  const [active, setActive] = useState(editing ? editing.active : true);
  const [save, saving, fieldErrors] = useAction(saveOvertimeBanner, {
    success: "Banner saved",
    onSuccess: () => {
      setEditing(null);
      setMessage("");
      setActive(true);
    },
  });
  const [toggle, toggling] = useAction(setOvertimeBannerActive, { success: "Banner updated" });

  return (
    <div className="flex flex-col gap-5">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save({ id: editing?.id, message, active });
        }}
      >
        <Field
          label={editing ? "Edit message" : "New message"}
          htmlFor="banner-message"
          hint={`${message.length}/500`}
          error={fieldErrors.message?.[0]}
        >
          <Textarea
            id="banner-message"
            value={message}
            maxLength={500}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Overtime available Saturday. Bid in Requests → Overtime."
            className="min-h-20"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={active} onChange={(e) => setActive(e.target.checked)} />
          Show this banner now
        </label>
        <div className="flex justify-end gap-2">
          {editing ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(null);
                setMessage("");
                setActive(true);
              }}
            >
              New banner instead
            </Button>
          ) : null}
          <Button type="submit" loading={saving}>
            {editing ? "Save changes" : "Create banner"}
          </Button>
        </div>
      </form>

      {banners.length ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Recent banners</p>
          <ul className="divide-y divide-border rounded-[var(--radius-control)] border border-border">
            {banners.map((b) => (
              <li key={b.id} className="flex items-start gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm">{b.message}</p>
                  {b.active ? (
                    <Badge tone="success" dot className="mt-1">
                      Showing
                    </Badge>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(b);
                      setMessage(b.message);
                      setActive(b.active);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={toggling}
                    onClick={() => void toggle({ id: b.id, active: !b.active })}
                  >
                    {b.active ? "Hide" : "Show"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
