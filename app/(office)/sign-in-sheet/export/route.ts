import { parseYmd } from "@/components/ops/time";
import { requireAuth } from "@/lib/auth/session";
import { fmtTime, todayIn } from "@/lib/format";
import { toCsv } from "@/lib/labor/payroll";
import { loadSignInSheet } from "../data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth("signInSheet");
  const tz = auth.org.timezone;
  const date = parseYmd(new URL(request.url).searchParams.get("date") ?? undefined, todayIn(tz));
  const shifts = await loadSignInSheet(auth, date);
  const t = (v: string | null) => (v ? fmtTime(v, tz, auth.settings.clock24h) : "");

  const out: (string | number | null)[][] = [
    [
      "Seniority#", "Employee ID", "Name", "Scheduled Start", "Scheduled End", "Actual Start", "Actual End",
      "Status", "Bus", "Bus Type", "Tablet", "Radio Code", "Lunch Waiver", "Signed in at kiosk",
    ],
  ];
  for (const s of shifts) {
    out.push([
      s.employee.seniority_number ?? "",
      s.employee.employee_number,
      `${s.employee.first_name} ${s.employee.last_name}`,
      t(s.scheduled_start),
      t(s.scheduled_end),
      t(s.clock_in_at),
      t(s.clock_out_at),
      s.status,
      s.vehicle?.number ?? "",
      s.vehicle?.powertrain ?? "",
      s.tablet?.number ?? "",
      s.radio_status ?? "",
      s.meal_waived ? "Yes" : "",
      s.device?.name ?? "",
    ]);
  }
  return new Response(toCsv(out), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="sign-in-sheet-${date}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
