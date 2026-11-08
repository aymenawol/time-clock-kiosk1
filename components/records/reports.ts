import "server-only";
import { buildPayLines, minutesToHours } from "@/lib/labor/payroll";
import { SHIFT_WITH_BREAKS, toShiftRecords } from "@/lib/labor/records";
import { localDate, startOfLocalDate, startOfWorkweek, type WeekStart } from "@/lib/labor/time";
import type { ShiftRecord } from "@/lib/labor/types";
import type { AuthContext } from "@/lib/auth/session";
import { fmtDateTime } from "@/lib/format";
import { FORM_META, type FormType } from "@/lib/forms";
import { dayRange } from "./params";

export const REPORTS = {
  hours: "Hours by employee",
  overtime: "Overtime awards",
  requests: "Requests",
  safety: "Safety attendance",
  bids: "Bid awards",
  inspections: "Inspection completion",
  fuel: "Fuel usage",
  lostfound: "Lost and found",
} as const;
export type ReportKey = keyof typeof REPORTS;
export const isReportKey = (v: string): v is ReportKey => v in REPORTS;

type Cell = string | number | null;
export interface Report {
  title: string;
  columns: string[];
  /** Columns (by index) to right-align. */
  numeric: number[];
  rows: Cell[][];
  notes: string[];
}

const LIMIT = 20000;

export async function buildReport(auth: AuthContext, key: ReportKey, from: string, to: string): Promise<Report> {
  const base = { title: REPORTS[key], numeric: [] as number[], notes: [] as string[] };
  const { supabase, org, settings } = auth;
  const tz = org.timezone;
  const { start, end } = dayRange(from, to, tz);
  const orgId = org.id;
  const dt = (d: string | null) => (d ? fmtDateTime(d, tz, settings.clock24h) : "");

  const people = await (async () => {
    const { data } = await supabase
      .from("employees")
      .select("id, first_name, last_name, employee_number")
      .eq("organization_id", orgId);
    const byId = new Map((data ?? []).map((e) => [e.id, e]));
    return {
      list: data ?? [],
      name: (id: string | null) => {
        const e = id ? byId.get(id) : null;
        return e ? `${e.first_name} ${e.last_name}` : "";
      },
    };
  })();

  switch (key) {
    case "hours": {
      const ws = settings.workweekStartsOn as WeekStart;
      const weekStart = localDate(startOfWorkweek(startOfLocalDate(from, tz), tz, ws), tz);
      const [shiftsRes, compRes] = await Promise.all([
        supabase
          .from("shifts")
          .select(SHIFT_WITH_BREAKS)
          .eq("organization_id", orgId)
          .neq("status", "void")
          .gte("work_date", weekStart)
          .lte("work_date", to)
          .limit(LIMIT),
        supabase
          .from("employee_compensation")
          .select("employee_id, pay_rate_cents, daily_ot_exempt")
          .eq("organization_id", orgId),
      ]);
      const comp = new Map((compRes.data ?? []).map((c) => [c.employee_id, c]));
      if ((compRes.data ?? []).length === 0 && people.list.length > 0) {
        base.notes.push(
          "Pay rates are visible to admins only. Daily overtime is calculated as if every employee is paid below 1.5 times the minimum wage and is not exempt.",
        );
      }
      const byEmployee = new Map<string, ShiftRecord[]>();
      for (const r of toShiftRecords((shiftsRes.data ?? []) as never)) {
        byEmployee.set(r.employeeId, [...(byEmployee.get(r.employeeId) ?? []), r]);
      }
      const lines = buildPayLines(
        people.list.map((e) => ({
          id: e.id,
          employeeNumber: e.employee_number,
          name: `${e.first_name} ${e.last_name}`,
          payRateCents: comp.get(e.id)?.pay_rate_cents ?? 0,
          dailyOtExempt: comp.get(e.id)?.daily_ot_exempt ?? false,
        })),
        byEmployee,
        {
          startsOn: from,
          endsOn: to,
          timeZone: tz,
          weekStartsOn: ws,
          minimumWageCents: settings.labor.minimumWageCents,
          dailyOvertimeEnabled: settings.labor.dailyOvertime,
          dailyOvertimeMinutes: settings.labor.dailyOvertimeMinutes,
          weeklyOvertimeMinutes: settings.labor.weeklyOvertimeMinutes,
          overtimeMultiplier: settings.labor.overtimeMultiplier,
        },
      );
      base.notes.push("Completed shifts only. Weekly overtime counts the full workweek, including days before the start date.");
      return {
        ...base,
        columns: ["Employee #", "Name", "Shifts", "Worked h", "Regular h", "Daily OT h", "Weekly OT h", "Open shifts"],
        numeric: [2, 3, 4, 5, 6, 7],
        rows: lines.map((l) => [
          l.employee_number,
          l.name,
          l.detail.shifts - l.detail.openShifts,
          minutesToHours(l.regular_minutes + l.daily_ot_minutes + l.weekly_ot_minutes),
          minutesToHours(l.regular_minutes),
          minutesToHours(l.daily_ot_minutes),
          minutesToHours(l.weekly_ot_minutes),
          l.detail.openShifts,
        ]),
      };
    }

    case "overtime": {
      const { data: offers } = await supabase
        .from("ot_offers")
        .select("id, description, starts_at, duration_minutes, slots, status")
        .eq("organization_id", orgId)
        .gte("starts_at", start)
        .lt("starts_at", end)
        .order("starts_at", { ascending: false })
        .limit(LIMIT);
      const ids = (offers ?? []).map((o) => o.id);
      const { data: awards } = ids.length
        ? await supabase.from("ot_awards").select("offer_id, employee_id, method, created_at").eq("organization_id", orgId).in("offer_id", ids)
        : { data: [] };
      const rows: Cell[][] = [];
      for (const o of offers ?? []) {
        const mine = (awards ?? []).filter((a) => a.offer_id === o.id);
        const common = [dt(o.starts_at), o.description ?? "", minutesToHours(o.duration_minutes), o.slots, o.status];
        if (mine.length === 0) rows.push([...common, "", "", ""]);
        for (const a of mine) rows.push([...common, people.name(a.employee_id), a.method, dt(a.created_at)]);
      }
      return {
        ...base,
        columns: ["Starts", "Description", "Hours", "Slots", "Offer status", "Awarded to", "Method", "Awarded at"],
        numeric: [2, 3],
        rows,
      };
    }

    case "requests": {
      const { data } = await supabase
        .from("form_submissions")
        .select("form_type, status")
        .eq("organization_id", orgId)
        .gte("created_at", start)
        .lt("created_at", end)
        .limit(LIMIT);
      const statuses = ["submitted", "approved", "denied", "returned", "withdrawn"];
      const table = new Map<string, Record<string, number>>();
      for (const f of data ?? []) {
        const row = table.get(f.form_type) ?? {};
        row[f.status] = (row[f.status] ?? 0) + 1;
        table.set(f.form_type, row);
      }
      return {
        ...base,
        columns: ["Request type", "Pending", "Approved", "Denied", "Returned", "Withdrawn", "Total"],
        numeric: [1, 2, 3, 4, 5, 6],
        rows: [...table.entries()].map(([type, counts]) => [
          FORM_META[type as FormType]?.label ?? type,
          ...statuses.map((s) => counts[s] ?? 0),
          Object.values(counts).reduce((a, b) => a + b, 0),
        ]),
      };
    }

    case "safety": {
      const { data: meetings } = await supabase
        .from("safety_meetings")
        .select("id, title, starts_at, status")
        .eq("organization_id", orgId)
        .gte("starts_at", start)
        .lt("starts_at", end)
        .order("starts_at", { ascending: false })
        .limit(LIMIT);
      const ids = (meetings ?? []).map((m) => m.id);
      const { data: att } = ids.length
        ? await supabase.from("safety_attendance").select("meeting_id, status").eq("organization_id", orgId).in("meeting_id", ids)
        : { data: [] };
      return {
        ...base,
        columns: ["Date", "Meeting", "Status", "Present", "Late", "Absent", "Excused", "Attendance %"],
        numeric: [3, 4, 5, 6, 7],
        rows: (meetings ?? []).map((m) => {
          const mine = (att ?? []).filter((a) => a.meeting_id === m.id);
          const n = (s: string) => mine.filter((a) => a.status === s).length;
          const attended = n("present") + n("late");
          return [
            dt(m.starts_at),
            m.title,
            m.status,
            n("present"),
            n("late"),
            n("absent"),
            n("excused"),
            mine.length ? Math.round((attended / mine.length) * 100) : null,
          ];
        }),
      };
    }

    case "bids": {
      const { data: awards } = await supabase
        .from("bid_awards")
        .select("cycle_id, employee_id, line_id, choice_rank, method, created_at")
        .eq("organization_id", orgId)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      const [{ data: cycles }, { data: lines }] = await Promise.all([
        supabase.from("bid_cycles").select("id, name").eq("organization_id", orgId),
        supabase.from("bid_lines").select("id, line_number, line_type").eq("organization_id", orgId),
      ]);
      const cycleName = new Map((cycles ?? []).map((c) => [c.id, c.name]));
      const line = new Map((lines ?? []).map((l) => [l.id, l]));
      return {
        ...base,
        columns: ["Awarded", "Cycle", "Employee", "Line", "Line type", "Choice", "Method"],
        numeric: [3, 5],
        rows: (awards ?? []).map((a) => [
          dt(a.created_at),
          cycleName.get(a.cycle_id) ?? "",
          people.name(a.employee_id),
          line.get(a.line_id)?.line_number ?? null,
          line.get(a.line_id)?.line_type ?? "",
          a.choice_rank,
          a.method,
        ]),
      };
    }

    case "inspections": {
      const { data: shifts } = await supabase
        .from("shifts")
        .select("id, employee_id")
        .eq("organization_id", orgId)
        .neq("status", "void")
        .not("vehicle_id", "is", null)
        .gte("work_date", from)
        .lte("work_date", to)
        .limit(LIMIT);
      const shiftIds = new Set((shifts ?? []).map((s) => s.id));
      const pad = 2 * 86_400_000;
      const { data: insp } = await supabase
        .from("inspections")
        .select("shift_id, kind, submitted_at")
        .eq("organization_id", orgId)
        .not("submitted_at", "is", null)
        .gte("created_at", new Date(new Date(start).getTime() - pad).toISOString())
        .lt("created_at", new Date(new Date(end).getTime() + pad).toISOString())
        .limit(LIMIT);
      const done = new Map<string, Set<string>>();
      for (const i of insp ?? []) {
        if (!shiftIds.has(i.shift_id)) continue;
        const s = done.get(i.shift_id) ?? new Set();
        s.add(i.kind);
        done.set(i.shift_id, s);
      }
      const per = new Map<string, { shifts: number; pre: number; post: number }>();
      for (const s of shifts ?? []) {
        const row = per.get(s.employee_id) ?? { shifts: 0, pre: 0, post: 0 };
        row.shifts += 1;
        if (done.get(s.id)?.has("pre_trip")) row.pre += 1;
        if (done.get(s.id)?.has("post_trip")) row.post += 1;
        per.set(s.employee_id, row);
      }
      const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
      return {
        ...base,
        columns: ["Driver", "Shifts with a vehicle", "Pre-trip done", "Post-trip done", "Pre-trip %", "Post-trip %"],
        numeric: [1, 2, 3, 4, 5],
        rows: [...per.entries()]
          .map(([id, r]) => [people.name(id), r.shifts, r.pre, r.post, pct(r.pre, r.shifts), pct(r.post, r.shifts)] as Cell[])
          .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      };
    }

    case "fuel": {
      const [{ data: logs }, { data: vehicles }] = await Promise.all([
        supabase
          .from("fuel_logs")
          .select("vehicle_id, service, quantity")
          .eq("organization_id", orgId)
          .gte("created_at", start)
          .lt("created_at", end)
          .limit(LIMIT),
        supabase.from("vehicles").select("id, number").eq("organization_id", orgId),
      ]);
      const number = new Map((vehicles ?? []).map((v) => [v.id, v.number]));
      const per = new Map<string, { fills: number; gal: number; charges: number; kwh: number; washes: number }>();
      for (const l of logs ?? []) {
        const r = per.get(l.vehicle_id) ?? { fills: 0, gal: 0, charges: 0, kwh: 0, washes: 0 };
        if (l.service === "fuel") {
          r.fills += 1;
          r.gal += Number(l.quantity ?? 0);
        } else if (l.service === "charge") {
          r.charges += 1;
          r.kwh += Number(l.quantity ?? 0);
        } else r.washes += 1;
        per.set(l.vehicle_id, r);
      }
      return {
        ...base,
        columns: ["Vehicle", "Fuel fills", "Gallons", "Charges", "kWh", "Washes"],
        numeric: [1, 2, 3, 4, 5],
        rows: [...per.entries()]
          .map(([id, r]) => [number.get(id) ?? "", r.fills, Math.round(r.gal * 10) / 10, r.charges, Math.round(r.kwh * 10) / 10, r.washes] as Cell[])
          .sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true })),
      };
    }

    case "lostfound": {
      const { data } = await supabase
        .from("lost_items")
        .select("reference, description, category, status, found_at, closed_at")
        .eq("organization_id", orgId)
        .gte("found_at", start)
        .lt("found_at", end)
        .order("found_at", { ascending: false })
        .limit(LIMIT);
      return {
        ...base,
        columns: ["Reference", "Found", "Item", "Category", "Status", "Closed"],
        rows: (data ?? []).map((i) => [i.reference, dt(i.found_at), i.description, i.category, i.status, dt(i.closed_at)]),
      };
    }
  }
}
