"use client";

import { Pencil } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { setBreakSlot } from "../actions";

export interface SlotView {
  id: string;
  /** "06:15-06:30" */
  label: string;
  /** Window start as "HH:mm" in the organization time zone. */
  time: string;
  /** The break already started (or the shift is over), so it can't be moved. */
  locked: boolean;
  lockedReason: string;
}

/** The shift's BRK Windows, "06:15-06:30 / 09:45-10:00", with a small edit control per slot for dispatch. */
export function BreakSlots({ name, slots, canEdit }: { name: string; slots: SlotView[]; canEdit: boolean }) {
  const [editing, setEditing] = React.useState<{ slot: SlotView; index: number } | null>(null);
  const [time, setTime] = React.useState("");
  const [run, pending] = useAction(setBreakSlot, { success: "Break slot saved", onSuccess: () => setEditing(null) });

  if (!slots.length) return <span className="text-muted">-</span>;
  return (
    <>
      <span className="inline-flex flex-wrap items-center gap-x-1 tabular whitespace-nowrap">
        {slots.map((s, i) => (
          <React.Fragment key={s.id}>
            {i > 0 ? <span className="text-muted">/</span> : null}
            <span>{s.label}</span>
            {canEdit ? (
              <button
                type="button"
                disabled={s.locked}
                title={s.locked ? s.lockedReason : "Set this break slot"}
                aria-label={`Change break ${i + 1} slot for ${name}`}
                onClick={() => {
                  setTime(s.time);
                  setEditing({ slot: s, index: i });
                }}
                className="inline-flex size-6 items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 print:hidden"
              >
                <Pencil className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </React.Fragment>
        ))}
      </span>
      <Dialog open={editing !== null} onOpenChange={(o) => (o ? null : setEditing(null))}>
        <DialogContent
          title={editing ? `Break ${editing.index + 1} slot for ${name}` : "Break slot"}
          description="The suggested time comes from the break plan. The slot keeps its length."
        >
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (editing) void run({ breakId: editing.slot.id, time });
            }}
          >
            <Field label="Slot starts at" htmlFor="slot-time" hint={editing ? `Now ${editing.slot.label}` : undefined}>
              <Input id="slot-time" type="time" required value={time} onChange={(e) => setTime(e.target.value)} className="tabular" />
            </Field>
            <Button type="submit" loading={pending} disabled={!time}>
              Save slot
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
