import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { audienceLabel } from "@/components/people/labels";
import { CopyScheduleLink, MeetingDialog } from "@/components/people/safety-client";
import { Badge, type Tone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { fmtDate, fmtTime } from "@/lib/format";

export const metadata = { title: "Safety meetings" };

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  scheduled: { label: "Scheduled", tone: "primary" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export default async function SafetyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requireAuth("safety");
  const sp = await searchParams;
  const tab = sp.tab === "past" ? "past" : "upcoming";
  const tz = auth.org.timezone;
  const manage = can(auth.employee.role, "safetyManage");
  const nowIso = new Date().toISOString();

  // "Upcoming" keeps a meeting visible until it ends, so a running meeting stays on top.
  const base = auth.supabase
    .from("safety_meetings")
    .select("id, title, audience, starts_at, duration_minutes, location, status")
    .eq("organization_id", auth.org.id);
  const { data } =
    tab === "upcoming"
      ? await base.gte("starts_at", new Date(Date.now() - 8 * 3600_000).toISOString()).neq("status", "cancelled").order("starts_at").limit(200)
      : await base.lt("starts_at", nowIso).order("starts_at", { ascending: false }).limit(100);
  const rows =
    tab === "upcoming"
      ? (data ?? []).filter((m) => m.status === "scheduled" ? new Date(m.starts_at).getTime() + m.duration_minutes * 60000 >= Date.now() : false)
      : (data ?? []);

  return (
    <>
      <PageHeader
        title="Safety meetings"
        description="Schedule meetings, record attendance and share the public schedule."
        actions={
          <>
            <CopyScheduleLink token={auth.org.public_token} />
            {manage ? <MeetingDialog timeZone={tz} /> : null}
          </>
        }
      />
      <div className="mb-4 inline-flex gap-1 rounded-[var(--radius-control)] bg-surface-2 p-1" role="tablist">
        {(["upcoming", "past"] as const).map((t) => (
          <Link
            key={t}
            href={`/safety?tab=${t}`}
            role="tab"
            aria-selected={tab === t}
            className={`rounded px-3 py-1.5 text-sm font-medium capitalize ${tab === t ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg"}`}
          >
            {t}
          </Link>
        ))}
      </div>
      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={tab === "upcoming" ? "No upcoming meetings" : "No past meetings"}
            description={tab === "upcoming" && manage ? "Schedule one and it shows on the public schedule page." : undefined}
          />
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Meeting</TH>
                <TH>When</TH>
                <TH>Location</TH>
                <TH>Audience</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((m) => {
                const st = STATUS[m.status];
                return (
                  <TR key={m.id}>
                    <TD>
                      <Link href={`/safety/${m.id}`} className="font-medium hover:text-primary">
                        {m.title}
                      </Link>
                    </TD>
                    <TD className="whitespace-nowrap">
                      {fmtDate(m.starts_at, tz)} · {fmtTime(m.starts_at, tz, auth.settings.clock24h)}
                    </TD>
                    <TD className="text-muted">{m.location ?? "-"}</TD>
                    <TD className="max-w-64 truncate text-muted">{audienceLabel(m.audience)}</TD>
                    <TD>
                      <Badge tone={st.tone} dot>
                        {st.label}
                      </Badge>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
