import { CalendarRange } from "lucide-react";
import Link from "next/link";
import { StatusPill, BID_CYCLE_STATUS } from "@/components/admin/status";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime, fmtLocalDate, todayIn } from "@/lib/format";
import { addDaysYmd } from "@/lib/scheduling/datetime";
import { CycleForm } from "./_components/cycle-form";

export const metadata = { title: "Shift bids" };

export default async function BidsPage() {
  const auth = await requireAuth("bids");
  const tz = auth.org.timezone;
  const { data } = await auth.supabase
    .from("bid_cycles")
    .select("*, bid_lines(count), bid_preferences(count), bid_awards(count)")
    .eq("organization_id", auth.org.id)
    .order("starts_on", { ascending: false });
  const cycles = data ?? [];

  const today = todayIn(tz);
  const initial = {
    name: "",
    description: "",
    starts_on: addDaysYmd(today, 30),
    ends_on: addDaysYmd(today, 150),
    opens_at: `${addDaysYmd(today, 1)}T08:00`,
    closes_at: `${addDaysYmd(today, 15)}T17:00`,
    max_choices: 3,
  };
  const count = (v: unknown) => (Array.isArray(v) ? ((v[0] as { count?: number } | undefined)?.count ?? 0) : 0);

  return (
    <>
      <PageHeader
        title="Shift Bid Cycles"
        description="Publish schedule lines, collect ranked choices and award them by seniority."
        actions={<CycleForm initial={initial} timeZone={tz} />}
      />
      <Card>
        {cycles.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="No bid cycles yet"
            description="Create a cycle, add its lines, then open bidding. Drivers rank lines from their phones."
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Cycle</TH>
                <TH>Schedule</TH>
                <TH>Bidding window</TH>
                <TH className="text-right">Lines</TH>
                <TH className="text-right">Bids</TH>
                <TH className="text-right">Awards</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <TBody>
              {cycles.map((c) => (
                <TR key={c.id}>
                  <TD className="min-w-48">
                    <Link href={`/bids/${c.id}`} className="font-medium text-primary hover:underline">
                      {c.name}
                    </Link>
                    {c.description ? <p className="line-clamp-1 text-xs text-muted">{c.description}</p> : null}
                  </TD>
                  <TD className="whitespace-nowrap">
                    {fmtLocalDate(c.starts_on, "MMM d, yyyy")} – {fmtLocalDate(c.ends_on, "MMM d, yyyy")}
                  </TD>
                  <TD className="whitespace-nowrap text-muted">
                    {fmtDateTime(c.opens_at, tz, auth.settings.clock24h)}
                    {" – "}
                    {fmtDateTime(c.closes_at, tz, auth.settings.clock24h)}
                  </TD>
                  <TD className="text-right tabular">{count(c.bid_lines)}</TD>
                  <TD className="text-right tabular">{count(c.bid_preferences)}</TD>
                  <TD className="text-right tabular">{count(c.bid_awards)}</TD>
                  <TD>
                    <StatusPill map={BID_CYCLE_STATUS} status={c.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
