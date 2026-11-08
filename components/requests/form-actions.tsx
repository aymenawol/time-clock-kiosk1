"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";
import { acknowledgeForm, withdrawForm } from "@/app/m/forms/actions";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/ui/use-action";

export function FormActions({
  id,
  status,
  acknowledged,
}: {
  id: string;
  status: string;
  acknowledged: boolean;
}) {
  const [withdraw, withdrawing] = useAction(withdrawForm, { success: "Request withdrawn" });
  const [ack, acking] = useAction(acknowledgeForm, { success: "Thanks, marked as seen" });

  return (
    <div className="flex flex-col gap-3">
      {status === "returned" ? (
        <Button asChild size="xl" className="w-full">
          <Link href={`/m/forms/${id}/edit`}>
            <Pencil aria-hidden /> Edit and send again
          </Link>
        </Button>
      ) : null}
      {status === "submitted" ? (
        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          loading={withdrawing}
          onClick={() => {
            if (window.confirm("Withdraw this request?")) void withdraw({ id });
          }}
        >
          Withdraw request
        </Button>
      ) : null}
      {(status === "approved" || status === "denied") && !acknowledged ? (
        <Button size="xl" className="w-full" loading={acking} onClick={() => void ack({ id })}>
          Got it
        </Button>
      ) : null}
    </div>
  );
}
