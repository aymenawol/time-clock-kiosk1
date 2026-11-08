"use client";

import { Check, CornerUpLeft, X } from "lucide-react";
import { useState } from "react";
import { reviewForm } from "@/app/(office)/forms/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";

export function FormReviewPanel({
  formId,
  canApprove,
  deduction,
  balance,
}: {
  formId: string;
  canApprove: boolean;
  deduction: { kindLabel: string; hours: number } | null;
  balance: number | null;
}) {
  const [comment, setComment] = useState("");
  const [hours, setHours] = useState(deduction ? String(deduction.hours) : "");
  const [run, pending, errors] = useAction(reviewForm, { success: (): string => "Decision saved" });
  const needsComment = comment.trim().length === 0;
  const hoursNum = Number(hours);
  const after = deduction && balance !== null && Number.isFinite(hoursNum) ? balance - hoursNum : null;

  const decide = (decision: "approved" | "denied" | "returned") =>
    void run({ id: formId, decision, comment, leaveHours: decision === "approved" && deduction ? hours : "" } as never);

  return (
    <div className="grid gap-4">
      {deduction ? (
        <div className="grid gap-3 rounded-[var(--radius-control)] bg-surface-2 p-3 text-sm sm:grid-cols-[1fr_9rem] sm:items-end">
          <div>
            <p className="font-medium">Approving deducts {deduction.kindLabel} hours from their balance.</p>
            <p className="text-muted">
              Current balance: {balance === null ? "unknown" : `${balance.toFixed(2)} h`}
              {after !== null ? ` · after approval: ${after.toFixed(2)} h` : ""}
            </p>
            {after !== null && after < 0 ? (
              <p className="mt-1 text-warning" role="status">
                This takes the balance below zero.
              </p>
            ) : null}
          </div>
          <Field label="Hours to deduct" htmlFor="fr-hours" error={errors.leaveHours?.[0]}>
            <Input id="fr-hours" type="number" step="0.25" min="0.25" value={hours} onChange={(e) => setHours(e.target.value)} />
          </Field>
        </div>
      ) : null}
      <Field label="Comment" htmlFor="fr-comment" hint="Required to deny or return. The employee sees it." error={errors.comment?.[0]}>
        <Textarea id="fr-comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
      </Field>
      <div className="flex flex-wrap gap-2">
        {canApprove ? (
          <Button variant="success" disabled={pending} onClick={() => decide("approved")}>
            <Check /> Approve
          </Button>
        ) : (
          <p className="self-center text-sm text-muted">Only an admin can approve a resignation.</p>
        )}
        <Button variant="warning" disabled={pending || needsComment} onClick={() => decide("returned")}>
          <CornerUpLeft /> Return for changes
        </Button>
        <Button variant="danger" disabled={pending || needsComment} onClick={() => decide("denied")}>
          <X /> Deny
        </Button>
      </div>
    </div>
  );
}
