import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { audienceLabel } from "@/components/people/labels";
import {
  AttendanceSelect,
  CopyScheduleLink,
  MarkAllPresentButton,
  MeetingDialog,
  MeetingStatusButtons,
} from "@/components/people/safety-client";
import { isoToInput } from "@/components/people/tz";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, PageHeader, Stat } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { zId } from "@/lib/actions";
import { can, ROLE_LABEL } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { fmtDate, fmtTime, fullName } from "@/lib/format";

export const metadata = { title: "Safety meeting" };

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("safety");
  const { id } = await params;
  if (!zId.safeParse(id).success) notFound();
  const tz = auth.org.timezone;
  const c24 = auth.settings.clock24h;
  const manage = can(auth.employee.role, "safetyManage");

  const { data: meeting } = await auth.supabase
    .from("safety_meetings")
    .select("*")
    .eq("id", id)
    .eq("organization_id", auth.org.id)
    .maybeSingle();
  if (!meeting) notFound();

  const [{ data: employees }, { data: attendance }] = await Promise.all([
    auth.supabase
      .from("employees")
      .select("id, first_name, last_name, employee_number, role, status")
      .eq("organization_id", auth.org.id)
      .neq("status", "terminated")
      .limit(5000),
    auth.supabase.from("safety_attendance").select("employee_id, status, signed_in_at").eq("meeting_id", id).limit(5000),
  ]);
  const recorded = new Map((attendance ?? []).map((a) => [a.employee_id, a]));
  const expected = (employees ?? [])
    .filter((e) => meeting.audience.length === 0 || meeting.audience.includes(e.role))
    .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
  const count = (s: string) => expected.filter((e) => recorded.get(e.id)?.status === s).length;
  const pending = expected.filter((e) => !recorded.has(e.id));
  const attended = count("present") + count("late");
  const denominator = expected.length - count("excused");
  const done = meeting.status === "completed";

  return (
    <>
      <Link href="/safety" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Safety meetings
      </Link>
      <PageHeader
        title={meeting.title}
        description={`${fmtDate(meeting.starts_at, tz, "EEEE, MMM d")} · ${fmtTime(meeting.starts_at, tz, c24)} · ${meeting.duration_minutes} min${meeting.location ? ` · ${meeting.location}` : ""}`}
        actions={
          <>
            <Badge tone={meeting.status === "scheduled" ? "primary" : meeting.status === "completed" ? "success" : "neutral"} dot>
              {meeting.status[0].toUpperCase() + meeting.status.slice(1)}
            </Badge>
            <CopyScheduleLink token={auth.org.public_token} label="Copy link" />
            {manage ? (
              <>
                <MeetingDialog
                  timeZone={tz}
                  initial={{
                    id: meeting.id,
                    title: meeting.title,
                    audience: meeting.audience,
                    startsAtInput: isoToInput(meeting.starts_at, tz),
                    duration: meeting.duration_minutes,
                    location: meeting.location ?? "",
                    notes: meeting.notes ?? "",
                  }}
                />
                <MeetingStatusButtons id={meeting.id} status={meeting.status} />
              </>
            ) : null}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Expected" value={expected.length} hint={audienceLabel(meeting.audience)} />
        <Stat label="Attended" value={attended} tone="success" hint={denominator > 0 ? `${Math.round((attended / denominator) * 100)}% of expected` : undefined} />
        <Stat label="Absent" value={count("absent")} tone={count("absent") ? "danger" : undefined} />
        <Stat label="Not recorded" value={pending.length} tone={pending.length && done ? "warning" : undefined} />
      </div>

      {meeting.notes ? (
        <Card className="mb-5">
          <CardHeader title="Notes" />
          <CardBody className="whitespace-pre-wrap text-sm">{meeting.notes}</CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Attendance"
          description="Employees can also sign in on their phones from 30 minutes before the start."
          actions={pending.length ? <MarkAllPresentButton meetingId={id} employeeIds={pending.map((p) => p.id)} /> : null}
        />
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Employee</TH>
              <TH>Role</TH>
              <TH>Signed in</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {expected.map((e) => {
              const r = recorded.get(e.id);
              return (
                <TR key={e.id}>
                  <TD>
                    <span className="flex items-center gap-3 font-medium">
                      <Avatar name={fullName(e)} />
                      {fullName(e)}
                    </span>
                  </TD>
                  <TD className="text-muted">{ROLE_LABEL[e.role]}</TD>
                  <TD className="text-muted">{r?.signed_in_at ? fmtTime(r.signed_in_at, tz, c24) : "-"}</TD>
                  <TD>
                    <AttendanceSelect meetingId={id} employeeId={e.id} name={fullName(e)} value={r?.status ?? ""} />
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
