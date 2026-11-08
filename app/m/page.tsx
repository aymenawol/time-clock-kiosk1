import { Megaphone } from "lucide-react";
import { getActiveShift, getLastShift, startOfToday } from "@/components/field/data";
import { LiveRefresh } from "@/components/realtime/use-live-refresh";
import { requireAuth } from "@/lib/auth/session";
import { fmtDate } from "@/lib/format";
import { AssistSection, DriverChecklist, type DriverTask, type OpenAssist, type TaskState } from "./_components/driver-tasks";
import { BreakTimeline, type TimelineBreak } from "./_components/break-timeline";
import { RadioPanel } from "./_components/radio-panel";
import { ShiftCard } from "./_components/shift-card";
import { DefectQueue } from "./defects/defect-queue";
import { FuelQueue } from "./fuel/fuel-queue";

export const metadata = { title: "Home" };

function greeting(hour: number) {
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default async function FieldHome() {
  const auth = await requireAuth("field");
  const { org, employee, settings } = auth;
  const tz = org.timezone;
  const role = employee.role;
  const isDriver = role === "driver";

  const shift = await getActiveShift(auth);
  const lastShift = shift ? null : await getLastShift(auth);
  const since = startOfToday(auth);

  const [breaksRes, codesRes, otRes, assistRes, inspRes, sheetRes, eosRes] = await Promise.all([
    shift
      ? auth.supabase
          .from("breaks")
          .select("id, kind, sequence, paid, planned_minutes, window_start, window_end, started_at, ended_at, status")
          .eq("organization_id", org.id)
          .eq("shift_id", shift.id)
          .order("sequence")
          .order("window_start", { nullsFirst: false })
      : null,
    isDriver
      ? auth.supabase
          .from("radio_codes")
          .select("id, code, label, is_alert")
          .eq("organization_id", org.id)
          .eq("active", true)
          .order("sort")
      : null,
    isDriver
      ? auth.supabase
          .from("announcements")
          .select("id, message")
          .eq("organization_id", org.id)
          .eq("kind", "overtime")
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(1)
      : null,
    isDriver
      ? auth.supabase
          .from("assist_requests")
          .select("id, passenger_name, status, response, created_at, airline:airlines(name)")
          .eq("organization_id", org.id)
          .eq("employee_id", employee.id)
          .in("status", ["pending", "acknowledged", "escalated"])
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(5)
      : null,
    isDriver && shift
      ? auth.supabase.from("inspections").select("kind, submitted_at").eq("organization_id", org.id).eq("shift_id", shift.id)
      : null,
    isDriver && shift
      ? auth.supabase.from("count_sheets").select("status").eq("organization_id", org.id).eq("shift_id", shift.id).maybeSingle()
      : null,
    isDriver && shift
      ? auth.supabase.from("end_of_shift_reports").select("id").eq("organization_id", org.id).eq("shift_id", shift.id).maybeSingle()
      : null,
  ]);

  const breaks: TimelineBreak[] = breaksRes?.data ?? [];
  const onBreak = breaks.some((b) => b.started_at && !b.ended_at);
  const overtime = otRes?.data?.[0] ?? null;
  const openAssists: OpenAssist[] = (assistRes?.data ?? []) as OpenAssist[];

  // Today's checklist: each step's state comes from what has been saved or submitted.
  const noVehicle = !shift?.vehicle;
  const insp = (kind: string) => (inspRes?.data ?? []).find((i) => i.kind === kind);
  const inspState = (kind: string): TaskState => {
    const i = insp(kind);
    return i?.submitted_at ? "done" : i ? "draft" : noVehicle ? "blocked" : "todo";
  };
  const blockedDetail = !shift ? "Clock in first" : "Waiting for a vehicle";
  const detail = (state: TaskState, todo: string): string =>
    state === "done" ? "Submitted" : state === "draft" ? "Draft saved. Finish and submit" : state === "blocked" ? blockedDetail : todo;

  const preState = inspState("pre_trip");
  const postState = inspState("post_trip");
  const countState: TaskState = !shift
    ? "blocked"
    : sheetRes?.data?.status === "submitted"
      ? "done"
      : sheetRes?.data
        ? "draft"
        : "todo";
  const eosState: TaskState = !shift ? "blocked" : eosRes?.data ? "done" : noVehicle ? "blocked" : "todo";

  const tasks: DriverTask[] = [
    { href: "/m/inspection/pre_trip", label: "Pre-trip inspection", state: preState, detail: detail(preState, "Check the vehicle before you roll") },
    { href: "/m/counts", label: "Counting sheet", state: countState, detail: detail(countState, "Count passengers at each departure") },
    { href: "/m/inspection/post_trip", label: "Post-trip inspection", state: postState, detail: detail(postState, "Inspect the vehicle when you finish") },
    { href: "/m/end-shift", label: "End of shift", state: eosState, detail: detail(eosState, "Report fuel or charge and bus status, then clock out") },
  ];

  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).format(now)) % 24;

  return (
    <div className="flex flex-col gap-4">
      <LiveRefresh
        organizationId={org.id}
        tables={["shifts", "breaks", "vehicles", "assist_requests", "announcements", ...(role === "technician" ? ["defects"] : [])]}
      />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          {greeting(hour)}, {employee.first_name}
        </h1>
        <p className="text-sm text-muted">{fmtDate(now, tz, "EEEE, MMMM d")}</p>
      </div>

      {overtime ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-[var(--radius-card)] border border-warning/30 bg-warning-soft px-4 py-3"
        >
          <Megaphone className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-warning">Overtime available</p>
            <p className="text-fg">{overtime.message}</p>
          </div>
        </div>
      ) : null}

      <ShiftCard
        shift={shift}
        lastShift={lastShift as React.ComponentProps<typeof ShiftCard>["lastShift"]}
        onBreak={onBreak}
        isDriver={isDriver}
        timeZone={tz}
        clock24h={settings.clock24h}
      />

      {shift ? (
        <BreakTimeline breaks={breaks} timeZone={tz} clock24h={settings.clock24h} mealWaived={shift.meal_waived} />
      ) : null}

      {isDriver && shift ? (
        <RadioPanel
          codes={codesRes?.data ?? []}
          current={shift.radio_status}
          currentAt={shift.radio_status_at}
          timeZone={tz}
          clock24h={settings.clock24h}
        />
      ) : null}

      {isDriver ? <DriverChecklist tasks={tasks} /> : null}
      {isDriver && shift ? <AssistSection open={openAssists} timeZone={tz} clock24h={settings.clock24h} /> : null}

      {role === "fueler" ? <FuelQueue auth={auth} /> : null}
      {role === "technician" ? <DefectQueue auth={auth} /> : null}
    </div>
  );
}
