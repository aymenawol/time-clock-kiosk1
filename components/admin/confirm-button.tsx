"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

/**
 * Two-step button for consequential actions: opens a dialog that states what
 * will happen and runs `onConfirm` only after the second click.
 */
export function ConfirmButton({
  title,
  description,
  confirmLabel,
  confirmVariant = "primary",
  onConfirm,
  children,
  details,
  ...buttonProps
}: Omit<ButtonProps, "onClick"> & {
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  confirmVariant?: ButtonProps["variant"];
  /** Resolve to `false` (or a result with ok: false) to keep the dialog open. */
  onConfirm: () => Promise<unknown>;
  details?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function confirm() {
    setBusy(true);
    try {
      const res = await onConfirm();
      const failed = res === false || (typeof res === "object" && res !== null && "ok" in res && res.ok === false);
      if (!failed) setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
      <Button type="button" {...buttonProps} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <DialogContent title={title} description={description}>
        {details ? <div className="mb-4 text-sm text-fg">{details}</div> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" variant={confirmVariant} onClick={confirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
