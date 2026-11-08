"use client";

import { Unlock } from "lucide-react";
import * as React from "react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Field, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { unlockPeriod } from "../actions";

export function UnlockButton({ id }: { id: string }) {
  const [reason, setReason] = React.useState("");
  const [run, , errors] = useAction(unlockPeriod, { success: "Pay period unlocked" });
  return (
    <ConfirmButton
      size="sm"
      variant="secondary"
      title="Unlock this pay period?"
      description="The stored pay lines are deleted and the period becomes editable. Lock it again when you are done."
      confirmLabel="Unlock"
      confirmVariant="danger"
      details={
        <Field label="Reason" htmlFor="unlock-reason" error={errors.reason?.[0]}>
          <Textarea id="unlock-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} />
        </Field>
      }
      onConfirm={() => run({ id, reason })}
    >
      <Unlock aria-hidden /> Unlock
    </ConfirmButton>
  );
}
