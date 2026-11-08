import { CalendarRange, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { nowMs } from "@/components/requests/data";
import { BackHeader, LoadError } from "@/components/requests/back-header";
import { BidPicker, type BidLineView } from "@/components/requests/bid-picker";
import { fmtClock, weekdayList } from "@/components/requests/data";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime, fmtLocalDate } from "@/lib/format";
import type { Tables } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Shift bids" };
export const dynamic = "force-dynamic";

const LINE_TYPE: Record<string, string> = { full_time: "Full time", part_time: "Part time", shuttle: "Shuttle", other: "Other" };

export default async function BidsPage() {
  const auth = await requireAuth("field");
  const tz = auth.org.timezone;
  const clock24h = auth.settings.clock24h;

  const { data: cycles, error } = await auth.supabase
    .from("bid_cycles")
    .select("*")
    .eq("organization_id", auth.org.id)
    .in("status", ["open", "closed", "awarded"])
    .order("starts_on", { ascending: false })
    .limit(10);
  if (error) {
    return (
      <>
        <BackHeader href="/m/requests" backLabel="Requests" title="Shift bids" />
        <LoadError what="shift bids" />
      </>
    );
  }
  const ids = (cycles ?? []).map((c) => c.id);

  const [linesRes, prefsRes, awardsRes, routesRes] = ids.length
    ? await Promise.all([
        auth.supabase.from("bid_lines").select("*").eq("organization_id", auth.org.id).in("cycle_id", ids).order("line_number"),
        auth.supabase.from("bid_preferences").select("*").eq("employee_id", auth.employee.id).in("cycle_id", ids),
        auth.supabase.from("bid_awards").select("*").eq("employee_id", auth.employee.id).in("cycle_id", ids),
        auth.supabase.from("routes").select("id, name").eq("organization_id", auth.org.id),
      ])
    : [null, null, null, null];

  const routeName = new Map((routesRes?.data ?? []).map((r) => [r.id, r.name]));
  const view = (l: Tables<"bid_lines">): BidLineView => ({
    id: l.id,
    lineNumber: l.line_number,
    times: `${fmtClock(l.start_time, clock24h)} to ${fmtClock(l.end_time, clock24h)}`,
    weekdays: weekdayList(l.weekdays),
    type: LINE_TYPE[l.line_type] ?? l.line_type,
    capacity: l.capacity,
    route: l.route_id ? (routeName.get(l.route_id) ?? null) : null,
    notes: l.notes,
  });

  const now = nowMs();
  return (
    <>
      <BackHeader href="/m/requests" backLabel="Requests" title="Shift bids" description="Rank the lines you want. Awards go by seniority." />
      {!cycles || cycles.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarRange} title="No bid cycles right now" description="When a bid opens, you will see its lines here." />
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {cycles.map((c) => {
            const lines = (linesRes?.data ?? []).filter((l) => l.cycle_id === c.id);
            const pref = (prefsRes?.data ?? []).find((p) => p.cycle_id === c.id);
            const award = (awardsRes?.data ?? []).find((a) => a.cycle_id === c.id);
            const isOpen = c.status === "open" && now >= new Date(c.opens_at).getTime() && now <= new Date(c.closes_at).getTime();
            const awardLine = award ? lines.find((l) => l.id === award.line_id) : null;
            const savedLines = (pref?.line_ids ?? []).map((id) => lines.find((l) => l.id === id)).filter((l) => l !== undefined);
            return (
              <section key={c.id} aria-labelledby={`c-${c.id}`} className="flex flex-col gap-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h2 id={`c-${c.id}`} className="text-lg font-semibold">
                      {c.name}
                    </h2>
                    <Badge tone={c.status === "open" ? "success" : c.status === "awarded" ? "primary" : "neutral"}>
                      {c.status === "open" ? (isOpen ? "Open" : "Not open yet") : c.status === "awarded" ? "Awarded" : "Closed"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted">
                    Lines run {fmtLocalDate(c.starts_on, "MMM d")} to {fmtLocalDate(c.ends_on, "MMM d, yyyy")}. Bidding closes{" "}
                    {fmtDateTime(c.closes_at, tz, clock24h)}.
                  </p>
                  {c.description ? <p className="mt-1 text-sm">{c.description}</p> : null}
                </div>

                {award ? (
                  <Card className="border-success">
                    <CardHeader title="Your award" description={award.choice_rank ? `Choice ${award.choice_rank}` : "Assigned by a manager"} />
                    <CardBody className="flex items-center gap-3">
                      <Trophy className="size-8 shrink-0 text-success" aria-hidden />
                      <div>
                        {awardLine ? (
                          <>
                            <p className="text-xl font-semibold">Line {awardLine.line_number}</p>
                            <p className="text-sm text-muted">
                              {fmtClock(awardLine.start_time, clock24h)} to {fmtClock(awardLine.end_time, clock24h)} · {weekdayList(awardLine.weekdays)}
                              {awardLine.route_id && routeName.get(awardLine.route_id) ? ` · ${routeName.get(awardLine.route_id)}` : ""}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm">Your line is assigned. Ask your supervisor for details.</p>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                ) : c.status === "awarded" ? (
                  <Card>
                    <CardBody className="text-sm text-muted">Awards are done. You do not have an award in this cycle.</CardBody>
                  </Card>
                ) : null}

                {isOpen ? (
                  lines.length === 0 ? (
                    <Card>
                      <EmptyState title="No lines yet" description="Lines have not been added to this cycle." />
                    </Card>
                  ) : (
                    <BidPicker cycleId={c.id} lines={lines.map(view)} maxChoices={c.max_choices} initial={pref?.line_ids ?? []} />
                  )
                ) : (
                  <Card>
                    <CardHeader title="Your submitted choices" description={pref ? `Saved ${fmtDateTime(pref.submitted_at, tz, clock24h)}` : undefined} />
                    <CardBody>
                      {savedLines.length === 0 ? (
                        <p className="text-sm text-muted">You did not submit choices for this cycle.</p>
                      ) : (
                        <ol className="flex flex-col gap-2 text-sm">
                          {savedLines.map((l, i) => (
                            <li key={l.id}>
                              <span className="font-medium">
                                {i + 1}. Line {l.line_number}
                              </span>{" "}
                              <span className="text-muted">
                                {fmtClock(l.start_time, clock24h)} to {fmtClock(l.end_time, clock24h)} · {weekdayList(l.weekdays)}
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </CardBody>
                  </Card>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
