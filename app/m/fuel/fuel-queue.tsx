import { Droplets, Fuel, History, BatteryCharging } from "lucide-react";
import { FUEL_QUEUE_STATUSES, lowEnergyThreshold } from "@/components/field/rules";
import { startOfToday } from "@/components/field/data";
import { Card, CardHeader } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/misc";
import type { AuthContext } from "@/lib/auth/session";
import { fmtTime } from "@/lib/format";
import { FuelList, type QueueVehicle } from "./_components/fuel-list";

const ORDER: Record<string, number> = { needs_fuel_wash: 0, needs_fuel: 1, charging: 2, needs_wash: 3 };
const SERVICE_ICON = { fuel: Fuel, wash: Droplets, charge: BatteryCharging } as const;

/** The fuel and wash queue plus the caller's services today. Used by /m and /m/fuel. */
export async function FuelQueue({ auth }: { auth: AuthContext }) {
  const { lowFuelPercent, evChargePercent } = auth.settings.readiness;
  const [vehiclesRes, logsRes] = await Promise.all([
    auth.supabase
      .from("vehicles")
      .select("id, number, vehicle_type, powertrain, status, energy_level, odometer")
      .eq("organization_id", auth.org.id)
      .eq("active", true)
      .order("number"),
    auth.supabase
      .from("fuel_logs")
      .select("id, service, energy_after, quantity, created_at, vehicle:vehicles(number, powertrain)")
      .eq("organization_id", auth.org.id)
      .eq("employee_id", auth.employee.id)
      .gte("created_at", startOfToday(auth))
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (vehiclesRes.error) {
    return (
      <Card role="alert" className="p-4 text-sm text-danger">
        The fuel queue could not be loaded. Refresh the page to try again.
      </Card>
    );
  }

  const queue: QueueVehicle[] = (vehiclesRes.data ?? [])
    .filter((v) => {
      if (FUEL_QUEUE_STATUSES.includes(v.status)) return true;
      if (v.status === "in_service" || v.status === "retired") return false;
      return v.energy_level !== null && v.energy_level < lowEnergyThreshold(v.powertrain, lowFuelPercent, evChargePercent);
    })
    .sort(
      (a, b) =>
        (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) ||
        (a.energy_level ?? 101) - (b.energy_level ?? 101) ||
        a.number.localeCompare(b.number, undefined, { numeric: true }),
    );
  const logs = logsRes.data ?? [];
  const tz = auth.org.timezone;

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="fuel-queue-title">
        <SectionTitle id="fuel-queue-title">
          Fuel and wash queue{queue.length ? ` · ${queue.length}` : ""}
        </SectionTitle>
        <FuelList vehicles={queue} lowFuelPercent={lowFuelPercent} evChargePercent={evChargePercent} />
      </section>

      <Card>
        <CardHeader title="My services today" description={logs.length ? `${logs.length} logged` : undefined} />
        {logs.length ? (
          <ul className="divide-y divide-border">
            {logs.map((l) => {
              const Icon = SERVICE_ICON[l.service as keyof typeof SERVICE_ICON] ?? Fuel;
              return (
                <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-info-soft text-info" aria-hidden>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium capitalize text-fg">
                      {l.service} · {l.vehicle?.number ?? "Vehicle"}
                    </p>
                    <p className="text-sm text-muted tabular">
                      {l.energy_after !== null ? `${l.energy_after}%` : null}
                      {l.energy_after !== null && l.quantity !== null ? " · " : null}
                      {l.quantity !== null ? `${l.quantity} ${l.service === "charge" ? "kWh" : "gal"}` : null}
                    </p>
                  </div>
                  <span className="text-sm text-muted tabular">{fmtTime(l.created_at, tz, auth.settings.clock24h)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="flex items-center gap-2 px-4 py-4 text-sm text-muted">
            <History className="size-4" aria-hidden /> Nothing logged yet today.
          </p>
        )}
      </Card>
    </div>
  );
}
