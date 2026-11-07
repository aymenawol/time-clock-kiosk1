import { FieldShell } from "@/components/shell/field-shell";
import { toShellUser } from "@/components/shell/shell-user";
import { GpsReporter } from "@/components/field/gps-reporter";
import { requireAuth } from "@/lib/auth/session";

export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth("field");
  let gps: React.ReactNode = null;
  if (auth.employee.role === "driver") {
    const { data: shift } = await auth.supabase
      .from("shifts")
      .select("id, vehicle_id")
      .eq("employee_id", auth.employee.id)
      .eq("status", "active")
      .maybeSingle();
    if (shift?.vehicle_id) gps = <GpsReporter shiftId={shift.id} intervalSeconds={auth.settings.gps.intervalSeconds} />;
  }
  return (
    <FieldShell user={toShellUser(auth)} extra={gps}>
      {children}
    </FieldShell>
  );
}
