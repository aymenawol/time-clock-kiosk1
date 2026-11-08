import { AlertTriangle, Clock } from "lucide-react";
import { getActiveShift, startOfToday } from "@/components/field/data";
import { FieldHeader, Notice } from "@/components/field/field-header";
import { LiveRefresh } from "@/components/realtime/use-live-refresh";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { requireAuth } from "@/lib/auth/session";
import { fmtTime } from "@/lib/format";
import { AssistForm, type AirlineOption } from "./assist-form";
import { AssistList, type AssistItem } from "./assist-list";

export const metadata = { title: "10-51 wheelchair request" };

export default async function AssistPage() {
  const auth = await requireAuth("driving");
  const shift = await getActiveShift(auth);
  const minutes = auth.settings.assist.escalationMinutes;

  const [airlinesRes, requestsRes] = await Promise.all([
    auth.supabase
      .from("airlines")
      .select("id, name, iata_code, assist_contact, location:locations(name)")
      .eq("organization_id", auth.org.id)
      .eq("active", true)
      .order("name"),
    auth.supabase
      .from("assist_requests")
      .select("id, passenger_name, flight_number, status, response, created_at, responded_at, airline:airlines(name)")
      .eq("organization_id", auth.org.id)
      .eq("employee_id", auth.employee.id)
      .gte("created_at", startOfToday(auth))
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const header = (
    <FieldHeader title="10-51 wheelchair request" description="Send a wheelchair assist request to dispatch." />
  );

  if (airlinesRes.error || requestsRes.error) {
    return (
      <>
        {header}
        <Notice tone="danger" icon={AlertTriangle} role="alert" title="Requests could not be loaded">
          Check your connection and refresh the page.
        </Notice>
      </>
    );
  }

  const airlines: AirlineOption[] = (airlinesRes.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    code: a.iata_code,
    contact: a.assist_contact,
    location: a.location?.name ?? null,
  }));
  const items: AssistItem[] = (requestsRes.data ?? []).map((r) => ({
    id: r.id,
    passengerName: r.passenger_name,
    flight: r.flight_number,
    status: r.status,
    response: r.response,
    airline: r.airline?.name ?? null,
    sentAt: fmtTime(r.created_at, auth.org.timezone, auth.settings.clock24h),
  }));
  const open = items.filter((i) => ["pending", "acknowledged", "escalated"].includes(i.status));

  return (
    <>
      <LiveRefresh organizationId={auth.org.id} tables={["assist_requests"]} />
      {header}
      <div className="flex flex-col gap-4">
        {items.length ? <AssistList items={items} escalationMinutes={minutes} /> : null}
        {!shift ? (
          <Card>
            <EmptyState
              icon={Clock}
              title="You are not clocked in"
              description="Clock in at the kiosk, then come back to send a request."
            />
          </Card>
        ) : (
          <AssistForm
            airlines={airlines}
            busNumber={shift.vehicle?.number ?? null}
            openCount={open.length}
            escalationMinutes={minutes}
          />
        )}
      </div>
    </>
  );
}
