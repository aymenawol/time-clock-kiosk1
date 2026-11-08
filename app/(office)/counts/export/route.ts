import { loadCountSheets, parseRows, rowTotal } from "@/components/records/counts-query";
import { isYmd } from "@/components/records/params";
import { loadPeople } from "@/components/records/people";
import { requireAuth } from "@/lib/auth/session";
import { todayIn } from "@/lib/format";
import { toCsv } from "@/lib/labor/payroll";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth("counts");
  const raw = new URL(request.url).searchParams.get("date") ?? "";
  const date = isYmd(raw) ? raw : todayIn(auth.org.timezone);
  const { sheets, columns, vehicleNumber, routeName } = await loadCountSheets(auth, date);
  const people = await loadPeople(auth);
  const ids = columns.map((c) => c.id);

  const out: (string | number | null)[][] = [
    ["Date", "Driver", "Vehicle", "Route", "Status", "Departure", ...columns.map((c) => c.name), "Total"],
  ];
  for (const s of sheets) {
    for (const r of parseRows(s.rows)) {
      out.push([
        date,
        people.name(s.employee_id),
        s.vehicle_id ? (vehicleNumber.get(s.vehicle_id) ?? "") : "",
        s.route_id ? (routeName.get(s.route_id) ?? "") : "",
        s.status,
        r.departure_time,
        ...ids.map((id) => r.counts[id] ?? 0),
        rowTotal(r, ids),
      ]);
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
