import type { VehicleStatus } from "@/lib/supabase/types";

/** Services a fueler can log (fuel_logs.service). */
export type FuelService = "fuel" | "wash" | "charge";

/** Vehicle statuses that put a vehicle in the fuel and wash queue. */
export const FUEL_QUEUE_STATUSES: VehicleStatus[] = ["needs_fuel_wash", "needs_fuel", "charging", "needs_wash"];

/**
 * Vehicle status after a service, following v0's fueler rules:
 * fuel clears the fuel half of "fuel + wash", wash clears the wash half, and
 * a finished charge makes a charging vehicle ready. Anything else is unchanged.
 */
export function statusAfterService(service: FuelService, status: VehicleStatus): VehicleStatus {
  switch (service) {
    case "fuel":
      if (status === "needs_fuel") return "ready";
      if (status === "needs_fuel_wash") return "needs_wash";
      return status;
    case "wash":
      if (status === "needs_wash") return "ready";
      if (status === "needs_fuel_wash") return "needs_fuel";
      return status;
    case "charge":
      return status === "charging" ? "ready" : status;
  }
}

/** Low-energy threshold for a vehicle: EVs use the charge threshold. */
export function lowEnergyThreshold(powertrain: string, lowFuelPercent: number, evChargePercent: number): number {
  return powertrain === "ev" ? evChargePercent : lowFuelPercent;
}

/** The service a vehicle most likely needs next, for preselecting the form. */
export function suggestedService(status: VehicleStatus, powertrain: string): FuelService {
  if (status === "needs_wash") return "wash";
  if (powertrain === "ev") return "charge";
  if (status === "charging" && powertrain === "hybrid") return "charge";
  return "fuel";
}

export const SEVERITY_ORDER: Record<string, number> = { critical: 0, major: 1, minor: 2 };
export const DEFECT_STATUS_ORDER: Record<string, number> = { in_progress: 0, open: 1, deferred: 2, resolved: 3 };

/** Statuses a technician may return to "ready" when repairs are done. */
export const SHOP_STATUSES: VehicleStatus[] = ["shop", "repair", "pmi", "safety_hold"];
