import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { ActionButton } from "@/components/admin/action-buttons";
import { OFF_DAY_RESPONSE, OT_OFFER_STATUS, StatusPill } from "@/components/admin/status";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime, fmtHours, fmtLocalDate, fullName, todayIn } from "@/lib/format";
import { fmtClockTime } from "@/lib/scheduling/datetime";
import { topBySeniority } from "@/lib/scheduling/overtime";
import { AwardPanel } from "./_components/award-panel";
import { BannerForm } from "./_components/banner-form";
import { OffDayForm } from "./_components/off-day-form";
import { OfferForm } from "./_components/offer-form";
import { loadOfferDetail } from "./_lib/ranking";
import { setOfferStatus, withdrawOffDayRequest } from "./actions";

export const metadata = { title: "Overtime" };

const count = (v: unknown) => (Array.isArray(v) ? ((v[0] as { count?: number } | undefined)?.count ?? 0) : 0);

export default async function OvertimePage({ searchParams }: { searchParams: Promise<{ offer?: string }> }) {
  const auth = await requireAuth("overtime");
  const { offer: offerParam } = await searchParams;
  const tz = auth.org.timezone;
  const c24 = auth.settings.clock24h;
  const db = auth.supabase;
  const org = auth.org.id;

  const [offersRes, bannerRes, offDayRes, staffRes] = await Promise.all([
    db
      .from("ot_offers")
      .select("*, ot_bids(count), ot_awards(count)")
      .eq("organization_id", org)
      .order("starts_at", { ascending: false })
      .limit(50),
    db
      .from("announcements")
      .select("message, active")
      .eq("organization_id", org)
      .eq("kind", "overtime")
      .order("updated_at", { ascending: false })
      .limit(1),
    db
      .from("off_day_requests")
      .select("*, employee:employees!off_day_requests_employee_id_fkey(first_name, last_name)")
      .eq("organization_id", org)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("employees")
      .select("id, first_name, last_name")
      .eq("organization_id", org)
      .eq("status", "active")
      .order("last_name"),
  ]);
  const offers = offersRes.data ?? [];
  const banner = bannerRes.data?.[0] ?? { message: "", active: false };
  const requests = offDayRes.data ?? [];
  const employees = (staffRes.data ?? []).map((e) => ({ id: e.id, name: fullName(e) }));
  const today = todayIn(tz);

  const detail = offerParam ? await loadOfferDetail(auth, offerParam) : null;
  const seniorityIds = detail
    ? topBySeniority(detail.ranked, detail.offer.slots).map((b) => b.id)
    : [];
  const offerTitle = detail
    ? `${fmtDateTime(detail.offer.starts_at, tz, c24)} (${fmtHours(detail.offer.duration_minutes)} h)`
    : "";

  return (
    <>
      <PageHeader title="Overtime" description="Post overtime, rank bids by seniority and award shifts." actions={<OfferForm defaultDate={today} />} />
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader title="OT availability banner" description="Shown on the dispatch board and to drivers while active." />
          <CardBody>
            <BannerForm message={banner.message} active={banner.active} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Overtime shifts" />
          {offers.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No overtime shifts posted" description="Post a shift and eligible employees can bid for it." />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Date</TH>
                  <TH>Start</TH>
                  <TH className="text-right">Hours</TH>
                  <TH>Description</TH>
                  <TH className="text-right">Slots</TH>
                  <TH className="text-right">Bids</TH>
                  <TH className="text-right">Awarded</TH>
                  <TH>Bidding closes</TH>
                  <TH>Status</TH>
                  <TH>
                    <span className="sr-only">Actions</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {offers.map((o) => (
                  <TR key={o.id} className={o.id === detail?.offer.id ? "bg-primary-soft/40" : undefined}>
                    <TD className="whitespace-nowrap font-medium">{fmtDateTime(o.starts_at, tz, c24).split(",")[0]}</TD>
                    <TD className="whitespace-nowrap tabular">{fmtDateTime(o.starts_at, tz, c24).split(", ")[1]}</TD>
                    <TD className="text-right tabular">{fmtHours(o.duration_minutes)}</TD>
                    <TD className="min-w-40 max-w-72 text-muted">{o.description}</TD>
                    <TD className="text-right tabular">{o.slots}</TD>
                    <TD className="text-right tabular">{count(o.ot_bids)}</TD>
                    <TD className="text-right tabular">{count(o.ot_awards)}</TD>
                    <TD className="whitespace-nowrap text-muted">{fmtDateTime(o.bid_closes_at, tz, c24)}</TD>
                    <TD>
                      <StatusPill map={OT_OFFER_STATUS} status={o.status} />
                    </TD>
                    <TD>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/overtime?offer=${o.id}`} scroll={false}>
                            {o.status === "awarded" || o.status === "cancelled" ? "View" : "Bids and award"}
                          </Link>
                        </Button>
                        {o.status === "open" ? (
                          <ActionButton size="sm" variant="ghost" action={setOfferStatus} input={{ id: o.id, to: "closed" }} success="Bidding closed">
                            Close
                          </ActionButton>
                        ) : null}
                        {o.status === "closed" ? (
                          <ActionButton size="sm" variant="ghost" action={setOfferStatus} input={{ id: o.id, to: "open" }} success="Bidding reopened">
                            Reopen
                          </ActionButton>
                        ) : null}
                        {o.status === "open" || o.status === "closed" ? (
                          <ActionButton
                            size="sm"
                            variant="ghost"
                            className="text-danger"
                            action={setOfferStatus}
                            input={{ id: o.id, to: "cancelled" }}
                            success="Offer cancelled"
                            confirm={{
                              title: "Cancel this overtime shift?",
                              description: "Employees who bid will no longer be considered. This can't be undone.",
                              confirmLabel: "Cancel shift",
                              danger: true,
                            }}
                          >
                            Cancel
                          </ActionButton>
                        ) : null}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        {detail ? (
          <AwardPanel
            offerId={detail.offer.id}
            title={offerTitle}
            slots={detail.offer.slots}
            awardable={detail.offer.status === "open" || detail.offer.status === "closed"}
            maxWeeklyHours={fmtHours(detail.maxWeeklyMinutes)}
            seniorityIds={seniorityIds}
            bidders={detail.ranked.map((b) => ({
              id: b.id,
              rank: b.rank,
              name: b.name,
              number: b.number,
              role: b.role,
              seniorityLabel: b.seniorityNumber !== null ? `#${b.seniorityNumber}` : b.hireDate ? fmtLocalDate(b.hireDate, "MMM d, yyyy") : "-",
              weekHours: fmtHours(b.currentWeekMinutes),
              projectedHours: fmtHours(b.projectedWeekMinutes),
              exceeds: b.exceedsWeeklyLimit,
              active: b.active,
              bidAtLabel: fmtDateTime(b.bidAt, tz, c24),
            }))}
            others={detail.others}
            awards={detail.awards.map((a) => ({ name: a.name, method: a.method, atLabel: fmtDateTime(a.at, tz, c24) }))}
          />
        ) : offerParam ? (
          <p className="text-sm text-muted" role="alert">
            That overtime shift no longer exists.
          </p>
        ) : null}

        <Card>
          <CardHeader
            title="Off-day work requests"
            description="Ask someone to work on a day off. Their answer shows here."
            actions={<OffDayForm employees={employees} defaultDate={today} />}
          />
          {requests.length === 0 ? (
            <EmptyState title="No off-day requests sent" />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Employee</TH>
                  <TH>Requested date</TH>
                  <TH>Message</TH>
                  <TH>Response</TH>
                  <TH>Availability</TH>
                  <TH>
                    <span className="sr-only">Actions</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {requests.map((r) => (
                  <TR key={r.id}>
                    <TD className="whitespace-nowrap font-medium">{fullName(r.employee)}</TD>
                    <TD className="whitespace-nowrap">{fmtLocalDate(r.work_date, "EEE, MMM d, yyyy")}</TD>
                    <TD className="min-w-40 max-w-72 text-muted">{r.message}</TD>
                    <TD>
                      <StatusPill map={OFF_DAY_RESPONSE} status={r.response} />
                    </TD>
                    <TD className="text-sm text-muted">
                      {r.response === "pending" || r.response === "declined" ? (
                        r.response_note ?? "-"
                      ) : (
                        <>
                          {r.available_from ? `From ${fmtClockTime(r.available_from, c24)}` : null}
                          {r.available_hours ? ` · ${r.available_hours} h available` : null}
                          {r.response_note ? ` · ${r.response_note}` : null}
                        </>
                      )}
                    </TD>
                    <TD className="text-right">
                      {r.response === "pending" ? (
                        <ActionButton
                          size="sm"
                          variant="ghost"
                          action={withdrawOffDayRequest}
                          input={{ id: r.id }}
                          success="Request withdrawn"
                          confirm={{ title: "Withdraw this request?", confirmLabel: "Withdraw", danger: true }}
                        >
                          Withdraw
                        </ActionButton>
                      ) : null}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
