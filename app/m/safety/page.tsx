import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { nowMs } from "@/components/requests/data";
import { BackHeader, LoadError } from "@/components/requests/back-header";
import { SafetySignIn } from "@/components/requests/safety-sign-in";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, SectionTitle } from "@/components/ui/misc";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime, fmtMinutes } from "@/lib/format";

export const metadata: Metadata = { title: "Safety meetings" };
export const dynamic = "force-dynamic";

const ATTENDANCE: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  present: { label: "Present", tone: "success" },
  late: { label: "Late", tone: "warning" },
  absent: { label: "Absent", tone: "danger" },
  excused: { label: "Excused", tone: "neutral" },
};

export default async function SafetyPage() {
  const auth = await requireAuth("field");
  const tz = auth.org.timezone;
  const clock24h = auth.settings.clock24h;
  const now = nowMs();
  // Meetings that ended in the last day are still listed so a late sign-in is not lost from view.
  const since = new Date(now - 24 * 3600_000).toISOString();

  const [meetingsRes, attendanceRes] = await Promise.all([
    auth.supabase
      .from("safety_meetings")
      .select("*")
      .eq("organization_id", auth.org.id)
      .eq("status", "scheduled")
      .gte("starts_at", since)
      .order("starts_at")
      .limit(30),
    auth.supabase
      .from("safety_attendance")
      .select("*, meeting:safety_meetings(title, starts_at)")
      .eq("organization_id", auth.org.id)
      .eq("employee_id", auth.employee.id)
      .order("signed_in_at", { ascending: false, nullsFirst: false })
      .limit(30),
  ]);
  if (meetingsRes.error || attendanceRes.error) {
    return (
      <>
        <BackHeader href="/m/requests" backLabel="Requests" title="Safety Meetings" />
        <LoadError what="safety meetings" />
      </>
    );
  }

  const attended = new Map((attendanceRes.data ?? []).map((a) => [a.meeting_id, a]));
  const meetings = (meetingsRes.data ?? [])
    .filter((m) => m.audience.length === 0 || m.audience.includes(auth.employee.role))
    .filter((m) => new Date(m.starts_at).getTime() + m.duration_minutes * 60_000 >= now || attended.has(m.id));

  return (
    <>
      <BackHeader href="/m/requests" backLabel="Requests" title="Safety Meetings" description="Sign in from 30 minutes before the start until the meeting ends." />
      <div className="flex flex-col gap-8">
        <section aria-label="Upcoming meetings" className="flex flex-col gap-3">
          <SectionTitle>Upcoming</SectionTitle>
          {meetings.length === 0 ? (
            <Card>
              <EmptyState icon={ShieldCheck} title="No meetings scheduled" description="Meetings for your role will show here." />
            </Card>
          ) : (
            meetings.map((m) => {
              const start = new Date(m.starts_at).getTime();
              const end = start + m.duration_minutes * 60_000;
              const canSignIn = now >= start - 30 * 60_000 && now <= end;
              const done = attended.get(m.id);
              const a = done ? ATTENDANCE[done.status] : null;
              return (
                <Card key={m.id}>
                  <CardHeader
                    title={m.title}
                    description={`${fmtDateTime(m.starts_at, tz, clock24h)} · ${fmtMinutes(m.duration_minutes)}${m.location ? ` · ${m.location}` : ""}`}
                    actions={a ? <Badge tone={a.tone}>{a.label}</Badge> : undefined}
                  />
                  <CardBody className="flex flex-col gap-3">
                    {m.notes ? <p className="whitespace-pre-wrap text-sm">{m.notes}</p> : null}
                    {done ? (
                      <p className="text-sm text-muted">You signed in {done.signed_in_at ? fmtDateTime(done.signed_in_at, tz, clock24h) : ""}.</p>
                    ) : canSignIn ? (
                      <SafetySignIn meetingId={m.id} />
                    ) : (
                      <p className="text-sm text-muted">Sign-in opens 30 minutes before the start.</p>
                    )}
                  </CardBody>
                </Card>
              );
            })
          )}
        </section>

        <section aria-label="My attendance" className="flex flex-col gap-3">
          <SectionTitle>My attendance</SectionTitle>
          {(attendanceRes.data ?? []).length === 0 ? (
            <p className="text-sm text-muted">No attendance recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(attendanceRes.data ?? []).map((a) => {
                const s = ATTENDANCE[a.status] ?? { label: a.status, tone: "neutral" as const };
                return (
                  <li key={a.meeting_id} className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{a.meeting?.title ?? "Safety meeting"}</span>
                      <span className="block text-sm text-muted">{a.meeting ? fmtDateTime(a.meeting.starts_at, tz, clock24h) : ""}</span>
                    </span>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
