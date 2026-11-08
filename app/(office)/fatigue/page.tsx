import { LiveRefresh } from "@/components/realtime/use-live-refresh";
import { PageHeader } from "@/components/ui/misc";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime, fullName } from "@/lib/format";
import { FatigueList, type AlertView } from "./_components/fatigue-list";

export const metadata = { title: "Fatigue" };

export default async function FatiguePage() {
  const auth = await requireAuth("fatigue");
  const tz = auth.org.timezone;
  const c24 = auth.settings.clock24h;

  const [alertsRes, peopleRes] = await Promise.all([
    auth.supabase
      .from("fatigue_alerts")
      .select("*, employee:employees!fatigue_alerts_employee_id_fkey(first_name, last_name)")
      .eq("organization_id", auth.org.id)
      .order("created_at", { ascending: false })
      .limit(200),
    auth.supabase.from("employees").select("id, first_name, last_name").eq("organization_id", auth.org.id),
  ]);
  const people = new Map((peopleRes.data ?? []).map((p) => [p.id, fullName(p)]));

  const alerts: AlertView[] = (alertsRes.data ?? []).map((a) => ({
    id: a.id,
    employeeId: a.employee_id,
    employeeName: fullName(a.employee),
    kind: a.kind,
    severity: a.severity,
    status: a.status as AlertView["status"],
    message: a.message,
    triggeredLabel: fmtDateTime(a.created_at, tz, c24),
    closedLabel: a.resolved_at ? fmtDateTime(a.resolved_at, tz, c24) : null,
    note: a.resolution_note,
    closedBy: a.resolved_by ? (people.get(a.resolved_by) ?? null) : null,
  }));
  const open = alerts.filter((a) => a.status === "open").length;

  return (
    <>
      <LiveRefresh organizationId={auth.org.id} tables={["fatigue_alerts"]} />
      <PageHeader
        title="Fatigue monitoring"
        description={
          open > 0 ? (
            <span className="text-danger">
              {open} unresolved alert{open === 1 ? "" : "s"}
            </span>
          ) : (
            "No unresolved alerts."
          )
        }
      />
      <FatigueList alerts={alerts} />
    </>
  );
}
