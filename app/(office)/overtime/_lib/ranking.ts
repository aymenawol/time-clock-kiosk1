import "server-only";
import type { AuthContext } from "@/lib/auth/session";
import { fullName } from "@/lib/format";
import { computeOvertime } from "@/lib/labor/overtime";
import { SHIFT_WITH_BREAKS, toShiftRecords } from "@/lib/labor/records";
import { DAY, nextWorkweekStart, startOfWorkweek, workweekKey, type WeekStart } from "@/lib/labor/time";
import type { ShiftRecord } from "@/lib/labor/types";
import { rankOtBidders, type RankedOtBidder } from "@/lib/scheduling/overtime";
import type { AppRole } from "@/lib/supabase/types";

export interface BidderInfo {
  id: string;
  seniorityNumber: number | null;
  hireDate: string | null;
  currentWeekMinutes: number;
  name: string;
  number: string;
  role: AppRole;
  active: boolean;
  bidAt: string;
}

export interface OfferDetail {
  offer: {
    id: string;
    starts_at: string;
    duration_minutes: number;
    slots: number;
    description: string | null;
    bid_closes_at: string;
    status: string;
    eligible_roles: AppRole[];
  };
  ranked: RankedOtBidder<BidderInfo>[];
  awards: { employeeId: string; name: string; method: string; at: string }[];
  /** Active employees in the eligible roles who did not bid (for manual awards). */
  others: { id: string; name: string; number: string; role: AppRole }[];
  weekStart: string;
  maxWeeklyMinutes: number;
}

/** Minutes worked by each employee in the workweek that contains `instant`. */
export async function weekMinutesFor(
  auth: AuthContext,
  employeeIds: string[],
  instant: Date,
): Promise<{ minutes: Map<string, number>; weekStart: Date }> {
  const tz = auth.org.timezone;
  const ws = auth.settings.workweekStartsOn as WeekStart;
  const weekStart = startOfWorkweek(instant, tz, ws);
  const weekEnd = nextWorkweekStart(instant, tz, ws);
  const minutes = new Map<string, number>();
  if (employeeIds.length === 0) return { minutes, weekStart };

  const { data } = await auth.supabase
    .from("shifts")
    .select(SHIFT_WITH_BREAKS)
    .eq("organization_id", auth.org.id)
    .in("employee_id", employeeIds)
    .neq("status", "void")
    .gte("clock_in_at", new Date(weekStart.getTime() - DAY).toISOString())
    .lt("clock_in_at", weekEnd.toISOString());
  const byEmp = new Map<string, ShiftRecord[]>();
  for (const r of toShiftRecords(data ?? [])) byEmp.set(r.employeeId, [...(byEmp.get(r.employeeId) ?? []), r]);

  const key = workweekKey(weekStart, tz, ws);
  for (const id of employeeIds) {
    const recs = byEmp.get(id);
    if (!recs) {
      minutes.set(id, 0);
      continue;
    }
    const res = computeOvertime(recs, { timeZone: tz, weekStartsOn: ws, dailyOvertime: false });
    minutes.set(id, Math.round(res.byWeek[key]?.worked ?? 0));
  }
  return { minutes, weekStart };
}

export async function loadOfferDetail(auth: AuthContext, offerId: string): Promise<OfferDetail | null> {
  const db = auth.supabase;
  const org = auth.org.id;
  const { data: offer } = await db.from("ot_offers").select("*").eq("id", offerId).eq("organization_id", org).maybeSingle();
  if (!offer) return null;

  const [bidsRes, awardsRes, staffRes] = await Promise.all([
    db.from("ot_bids").select("employee_id, created_at").eq("offer_id", offer.id).eq("organization_id", org),
    db.from("ot_awards").select("employee_id, method, created_at").eq("offer_id", offer.id).eq("organization_id", org),
    db
      .from("employees")
      .select("id, employee_number, first_name, last_name, role, status, seniority_number, hire_date")
      .eq("organization_id", org)
      .neq("status", "terminated"),
  ]);
  const bids = bidsRes.data ?? [];
  const staff = staffRes.data ?? [];
  const byId = new Map(staff.map((s) => [s.id, s]));

  const { minutes, weekStart } = await weekMinutesFor(
    auth,
    bids.map((b) => b.employee_id),
    new Date(offer.starts_at),
  );
  const maxWeeklyMinutes = Math.round(auth.settings.fatigue.maxWeeklyHours * 60);

  const bidders: BidderInfo[] = bids.flatMap((b) => {
    const e = byId.get(b.employee_id);
    if (!e) return [];
    return [
      {
        id: e.id,
        seniorityNumber: e.seniority_number,
        hireDate: e.hire_date,
        currentWeekMinutes: minutes.get(e.id) ?? 0,
        name: fullName(e),
        number: e.employee_number,
        role: e.role,
        active: e.status === "active",
        bidAt: b.created_at,
      },
    ];
  });
  const bidderIds = new Set(bidders.map((b) => b.id));

  return {
    offer: {
      id: offer.id,
      starts_at: offer.starts_at,
      duration_minutes: offer.duration_minutes,
      slots: offer.slots,
      description: offer.description,
      bid_closes_at: offer.bid_closes_at,
      status: offer.status,
      eligible_roles: offer.eligible_roles,
    },
    ranked: rankOtBidders(bidders, offer.duration_minutes, maxWeeklyMinutes),
    awards: (awardsRes.data ?? []).map((a) => {
      const e = byId.get(a.employee_id);
      return { employeeId: a.employee_id, name: e ? fullName(e) : "Former employee", method: a.method, at: a.created_at };
    }),
    others: staff
      .filter((s) => s.status === "active" && offer.eligible_roles.includes(s.role) && !bidderIds.has(s.id))
      .sort((a, b) => fullName(a).localeCompare(fullName(b)))
      .map((s) => ({ id: s.id, name: fullName(s), number: s.employee_number, role: s.role })),
    weekStart: weekStart.toISOString(),
    maxWeeklyMinutes,
  };
}
