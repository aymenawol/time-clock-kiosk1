"use client";

import { Lock, LockOpen, Play, Trash2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { useAction } from "@/components/ui/use-action";
import { deleteCycle, setCycleStatus } from "../actions";

export function CycleStatusActions({
  id,
  status,
  lineCount,
  bidCount,
}: {
  id: string;
  status: string;
  lineCount: number;
  bidCount: number;
}) {
  const router = useRouter();
  const [move] = useAction(setCycleStatus, { success: "Status updated" });
  const [remove] = useAction(deleteCycle, { success: "Bid cycle deleted", onSuccess: () => router.push("/bids") });

  return (
    <>
      {status === "draft" ? (
        <>
          <ConfirmButton
            variant="ghost"
            size="sm"
            title="Delete this draft?"
            description="The cycle and its lines are removed. This can't be undone."
            confirmLabel="Delete cycle"
            confirmVariant="danger"
            onConfirm={() => remove({ id })}
          >
            <Trash2 aria-hidden />
            Delete
          </ConfirmButton>
          <ConfirmButton
            size="sm"
            title="Open bidding?"
            description={`Employees can see the ${lineCount} lines and rank them until bidding closes. Lines can't be edited while bidding is open.`}
            confirmLabel="Open bidding"
            onConfirm={() => move({ id, to: "open" })}
            disabled={lineCount === 0}
          >
            <Play aria-hidden />
            Open bidding
          </ConfirmButton>
        </>
      ) : null}
      {status === "open" ? (
        <>
          {bidCount === 0 ? (
            <ConfirmButton
              variant="ghost"
              size="sm"
              title="Move back to draft?"
              description="Employees stop seeing this cycle, and you can edit its lines again."
              confirmLabel="Back to draft"
              onConfirm={() => move({ id, to: "draft" })}
            >
              <Undo2 aria-hidden />
              Back to draft
            </ConfirmButton>
          ) : null}
          <ConfirmButton
            size="sm"
            variant="warning"
            title="Close bidding?"
            description={`${bidCount} ${bidCount === 1 ? "employee has" : "employees have"} bid. Employees can't change their choices after this. You can reopen bidding if needed.`}
            confirmLabel="Close bidding"
            onConfirm={() => move({ id, to: "closed" })}
          >
            <Lock aria-hidden />
            Close bidding
          </ConfirmButton>
        </>
      ) : null}
      {status === "closed" ? (
        <ConfirmButton
          variant="secondary"
          size="sm"
          title="Reopen bidding?"
          description="Employees can change their choices again until you close bidding."
          confirmLabel="Reopen bidding"
          onConfirm={() => move({ id, to: "open" })}
        >
          <LockOpen aria-hidden />
          Reopen bidding
        </ConfirmButton>
      ) : null}
    </>
  );
}
