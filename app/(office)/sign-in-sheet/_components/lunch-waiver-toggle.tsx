"use client";

import { Checkbox } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { setMealWaived } from "../actions";

/** Per-row "Lunch waived" control for dispatch, supervisors and admins. */
export function LunchWaiverToggle({ shiftId, waived, name }: { shiftId: string; waived: boolean; name: string }) {
  const [run, pending] = useAction(setMealWaived, { success: "Lunch waiver saved" });
  return (
    <>
      <Checkbox
        aria-label={`Lunch waived for ${name}`}
        checked={waived}
        disabled={pending}
        onChange={(e) => void run({ shiftId, waived: e.target.checked })}
        className="print:hidden"
      />
      <span className="hidden print:inline">{waived ? "Yes" : "-"}</span>
    </>
  );
}
