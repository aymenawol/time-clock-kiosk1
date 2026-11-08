"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useAction } from "@/components/ui/use-action";
import { resolveEmergency } from "../actions";

export function ResolveButton({ id, unacknowledged }: { id: string; unacknowledged: number }) {
  const [open, setOpen] = useState(false);
  const [run, pending] = useAction(resolveEmergency, { success: "Emergency resolved", onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="success" size="lg">
          <CheckCircle2 />
          Resolve emergency
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Resolve this emergency?"
        description={
          unacknowledged > 0
            ? `${unacknowledged} ${unacknowledged === 1 ? "person has" : "people have"} not acknowledged yet. Resolving clears the alert for everyone.`
            : "Everyone has acknowledged. Resolving clears the alert for everyone."
        }
      >
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button variant="success" loading={pending} onClick={() => void run({ id })}>
            Yes, resolve
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
