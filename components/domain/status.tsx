import { Badge, type Tone } from "@/components/ui/badge";
import type { BreakStatus, VehicleStatus } from "@/lib/supabase/types";

export const VEHICLE_STATUS: Record<VehicleStatus, { label: string; tone: Tone }> = {
  ready: { label: "Ready", tone: "success" },
  in_service: { label: "In service", tone: "primary" },
  charging: { label: "Charging", tone: "info" },
  needs_fuel: { label: "Needs fuel", tone: "info" },
  needs_wash: { label: "Needs wash", tone: "info" },
  needs_fuel_wash: { label: "Fuel + wash", tone: "info" },
  pmi: { label: "PMI", tone: "warning" },
  repair: { label: "Repair", tone: "warning" },
  shop: { label: "Shop (DVIR)", tone: "danger" },
  safety_hold: { label: "Safety hold", tone: "danger" },
  training: { label: "Training", tone: "accent" },
  retired: { label: "Retired", tone: "neutral" },
};

export const VEHICLE_STATUS_ORDER = Object.keys(VEHICLE_STATUS) as VehicleStatus[];
export const AVAILABLE_STATUSES: VehicleStatus[] = ["ready"];
export const OUT_OF_SERVICE_STATUSES: VehicleStatus[] = ["shop", "repair", "pmi", "safety_hold", "retired"];

export function VehicleStatusPill({ status }: { status: VehicleStatus }) {
  const s = VEHICLE_STATUS[status];
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

export const BREAK_STATUS: Record<BreakStatus, { label: string; tone: Tone }> = {
  planned: { label: "Planned", tone: "neutral" },
  active: { label: "On break", tone: "primary" },
  completed: { label: "Taken", tone: "success" },
  missed: { label: "Missed", tone: "danger" },
  overrun: { label: "Overrun", tone: "warning" },
  waived: { label: "Waived", tone: "neutral" },
};

export function BreakStatusPill({ status }: { status: BreakStatus }) {
  const s = BREAK_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export const SEVERITY_TONE: Record<string, Tone> = { info: "info", warning: "warning", critical: "danger" };
