import type { Tone } from "@/components/ui/badge";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import type { AppRole } from "@/lib/supabase/types";

export const EMPLOYEE_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  on_leave: { label: "On leave", tone: "warning" },
  terminated: { label: "Terminated", tone: "neutral" },
};

export function audienceLabel(audience: readonly AppRole[]) {
  return audience.length === 0 ? "Everyone" : audience.map((r) => ROLE_LABEL[r]).join(", ");
}
