import { loadCountSheets, parseRows } from "@/components/records/counts-query";
import { isYmd } from "@/components/records/params";
import { loadPeople } from "@/components/records/people";
import { requireAuth } from "@/lib/auth/session";
import { columnSums } from "@/lib/counts/sheet";
import { fmtTime, todayIn } from "@/lib/format";
import { toCsv } from "@/lib/labor/payroll";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth("counts");
  const raw = new URL(request.url).searchParams.get("date") ?? "";
  const date = isYmd(raw) ? raw : todayIn(auth.org.timezone);
  const { sheets, columns, vehicleNumber, routeName } = await loadCountSheets(auth, date);
  const people = await loadPeople(auth);
  const ids = columns.map((c) => c.id);
  const sum = (counts: Record<string, number>) => ids.reduce((n, id) => n + (counts[id] ?? 0), 0);

  const out: (string | number | null)[][] = [
    ["Date", "Driver", "Vehicle", "Route", "Status", "Start time", "End time", "Departure", ...columns.map((c) => c.heading), "Total"],
  ];
  for (const s of sheets) {
    const lead = (departure: string) => [
      date,
      people.name(s.employee_id),
      s.vehicle_id ? (vehicleNumber.get(s.vehicle_id) ?? "") : "",
      s.route_id ? (routeName.get(s.route_id) ?? "") : "",
      s.status,
      fmtTime(s.created_at, auth.org.timezone, auth.settings.clock24h),
      s.submitted_at ? fmtTime(s.submitted_at, auth.org.timezone, auth.settings.clock24h) : "",
      departure,
    ];
    // Blank rows (kept on screen so entries hold their place) are not exported.
    const rows = parseRows(s.rows).filter((r) => r.departure_time || sum(r.counts) > 0);
    for (const r of rows) out.push([...lead(r.departure_time), ...ids.map((id) => r.counts[id] ?? 0), sum(r.counts)]);
    if (rows.length) {
      // One total per column, like the TOTALS boxes on the paper.
      const t = columnSums(rows, ids);
      out.push([...lead("TOTALS"), ...ids.map((id) => t[id]), sum(t)]);
    }
  }
  return new Response(toCsv(out), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="counting-sheets-${date}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
