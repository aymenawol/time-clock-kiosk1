import type { Metadata } from "next";
import { dayRange, serverNow } from "@/components/ops/time";
import { LiveRefresh } from "@/components/realtime/use-live-refresh";
import { PageHeader } from "@/components/ui/misc";
import { requireAuth } from "@/lib/auth/session";
import { todayIn } from "@/lib/format";
import { AssistBoard } from "./_components/assist-board";

export const metadata: Metadata = { title: "Assist requests" };

const SELECT = `id, status, created_at, escalated_at, responded_at, resolved_at, response, notes, passenger_name, flight_number,
  assist_type, passenger_count,
  employee:employees!assist_requests_employee_id_fkey(first_name, last_name),
  responder:employees!assist_requests_responded_by_fkey(first_name, last_name),
  vehicle:vehicles(number), airline:airlines(name, iata_code), location:locations(name, code)`;

export default async function AssistsPage() {
  const auth = await requireAuth("assists");
  const tz = auth.org.timezone;
  const dayStart = dayRange(todayIn(tz), tz).start.toISOString();
  const org = auth.org.id;

  const [active, resolved] = await Promise.all([
    auth.supabase
      .from("assist_requests")
      .select(SELECT)
      .eq("organization_id", org)
      .in("status", ["pending", "escalated", "acknowledged"])
      .order("created_at")
      .limit(100),
    auth.supabase
      .from("assist_requests")
      .select(SELECT)
      .eq("organization_id", org)
      .eq("status", "resolved")
      .gte("resolved_at", dayStart)
      .order("resolved_at", { ascending: false })
      .limit(100),
  ]);
  if (active.error) throw active.error;
  if (resolved.error) throw resolved.error;

  return (
    <>
      <LiveRefresh organizationId={org} tables={["assist_requests"]} debounceMs={500} />
      <PageHeader
        title="Assist requests"
        description="Wheelchair and passenger assist requests from drivers (10-51). Respond within the target time."
      />
      <AssistBoard
        active={active.data ?? []}
        resolved={resolved.data ?? []}
        serverNow={serverNow()}
        timeZone={tz}
        clock24h={auth.settings.clock24h}
        escalationMinutes={auth.settings.assist.escalationMinutes}
      />
    </>
  );
}
