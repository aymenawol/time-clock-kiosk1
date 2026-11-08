import { Clock3 } from "lucide-react";
import type { Metadata } from "next";
import { nowMs } from "@/components/requests/data";
import { BackHeader, LoadError } from "@/components/requests/back-header";
import { fmtClock } from "@/components/requests/data";
import { OffDayResponse, OfferBidButton } from "@/components/requests/overtime-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, SectionTitle } from "@/components/ui/misc";
import { requireAuth } from "@/lib/auth/session";
import { fmtDate, fmtDateTime, fmtLocalDate, fmtMinutes } from "@/lib/format";

export const metadata: Metadata = { title: "Overtime" };
export const dynamic = "force-dynamic";

const RESPONSE: Record<string, { label: string; tone: "neutral" | "success" | "danger" | "warning" }> = {
  accepted: { label: "You can work", tone: "success" },
  declined: { label: "You declined", tone: "neutral" },
  partial: { label: "Part of the day", tone: "warning" },
};

export default async function OvertimePage() {
  const auth = await requireAuth("field");
  const tz = auth.org.timezone;
  const clock24h = auth.settings.clock24h;
  const nowIso = new Date(nowMs()).toISOString();
  const me = auth.employee.id;

  const [offersRes, bidsRes, awardsRes, offDayRes] = await Promise.all([
    auth.supabase
      .from("ot_offers")
      .select("*")
      .eq("organization_id", auth.org.id)
      .eq("status", "open")
      .gt("bid_closes_at", nowIso)
      .order("starts_at"),
    auth.supabase.from("ot_bids").select("offer_id").eq("employee_id", me),
    auth.supabase.from("ot_awards").select("*, offer:ot_offers(*)").eq("employee_id", me).order("created_at", { ascending: false }).limit(20),
    auth.supabase
      .from("off_day_requests")
      .select("*")
      .eq("organization_id", auth.org.id)
      .eq("employee_id", me)
      .order("work_date", { ascending: false })
      .limit(20),
  ]);

  if (offersRes.error || awardsRes.error || offDayRes.error) {
    return (
      <>
        <BackHeader href="/m/requests" backLabel="Requests" title="Overtime" />
        <LoadError what="overtime" />
      </>
    );
  }

  const myBids = new Set((bidsRes.data ?? []).map((b) => b.offer_id));
  // Offers restricted to other roles cannot be bid on (RLS would refuse), so hide them.
  const offers = (offersRes.data ?? []).filter((o) => o.eligible_roles.length === 0 || o.eligible_roles.includes(auth.employee.role));
  const pending = (offDayRes.data ?? []).filter((r) => r.response === "pending");
  const answered = (offDayRes.data ?? []).filter((r) => r.response !== "pending");

  return (
    <>
      <BackHeader href="/m/requests" backLabel="Requests" title="Overtime" description="Extra shifts you can bid for." />
      <div className="flex flex-col gap-8">
        {pending.length > 0 ? (
          <section aria-label="Off-day requests waiting for you" className="flex flex-col gap-3">
            <SectionTitle>Asked to work on a day off</SectionTitle>
            {pending.map((r) => (
              <Card key={r.id} className="border-primary">
                <CardHeader title={fmtLocalDate(r.work_date, "EEEE, MMM d")} description="Waiting for your answer" />
                <CardBody className="flex flex-col gap-4">
                  <p className="whitespace-pre-wrap text-sm">{r.message}</p>
                  <OffDayResponse id={r.id} />
                </CardBody>
              </Card>
            ))}
          </section>
        ) : null}

        <section aria-label="Open overtime offers" className="flex flex-col gap-3">
          <SectionTitle>Open offers</SectionTitle>
          {offers.length === 0 ? (
            <Card>
              <EmptyState icon={Clock3} title="No open overtime" description="New offers show here when a supervisor posts them." />
            </Card>
          ) : (
            offers.map((o) => (
              <Card key={o.id}>
                <CardHeader
                  title={fmtDateTime(o.starts_at, tz, clock24h)}
                  description={`${fmtMinutes(o.duration_minutes)} · ${o.slots} ${o.slots === 1 ? "slot" : "slots"}`}
                  actions={myBids.has(o.id) ? <Badge tone="success">You bid</Badge> : undefined}
                />
                <CardBody className="flex flex-col gap-3">
                  {o.description ? <p className="whitespace-pre-wrap text-sm">{o.description}</p> : null}
                  <p className="text-xs text-muted">Bidding closes {fmtDateTime(o.bid_closes_at, tz, clock24h)}. Awards go by seniority.</p>
                  <OfferBidButton offerId={o.id} bid={myBids.has(o.id)} />
                </CardBody>
              </Card>
            ))
          )}
        </section>

        <section aria-label="My overtime awards" className="flex flex-col gap-3">
          <SectionTitle>My awards</SectionTitle>
          {(awardsRes.data ?? []).length === 0 ? (
            <p className="text-sm text-muted">You have not been awarded overtime yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(awardsRes.data ?? []).map((a) => (
                <li key={a.id} className="rounded-[var(--radius-card)] border border-border bg-surface p-3">
                  <p className="font-medium">{a.offer ? fmtDateTime(a.offer.starts_at, tz, clock24h) : "Overtime shift"}</p>
                  <p className="text-sm text-muted">
                    {a.offer ? `${fmtMinutes(a.offer.duration_minutes)}${a.offer.description ? ` · ${a.offer.description}` : ""}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {answered.length > 0 ? (
          <section aria-label="Answered off-day requests" className="flex flex-col gap-3">
            <SectionTitle>Earlier day-off requests</SectionTitle>
            <ul className="flex flex-col gap-2">
              {answered.map((r) => {
                const s = RESPONSE[r.response] ?? { label: r.response, tone: "neutral" as const };
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3">
                    <span className="min-w-0">
                      <span className="block font-medium">{fmtLocalDate(r.work_date)}</span>
                      <span className="block truncate text-sm text-muted">
                        {r.response === "partial" && r.available_from
                          ? `From ${fmtClock(r.available_from, clock24h)} for ${r.available_hours} h`
                          : r.responded_at
                            ? `Answered ${fmtDate(r.responded_at, tz)}`
                            : ""}
                      </span>
                    </span>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
