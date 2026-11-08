"use client";

import { RotateCcw } from "lucide-react";
import { reopenBreak } from "@/app/(office)/board/actions";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/ui/use-action";

/** Re-open a missed break (dispatch). The RPC gives a fresh window. */
export function ReopenBreakButton({ breakId, label = "Re-open", className }: { breakId: string; label?: string; className?: string }) {
  const [run, pending] = useAction(reopenBreak, { success: "Break re-opened. The employee was notified." });
  return (
    <Button variant="secondary" size="sm" className={className} loading={pending} onClick={() => void run({ breakId })}>
      <RotateCcw />
      {label}
    </Button>
  );
}
