import { requireAuth } from "@/lib/auth/session";
import { fullName } from "@/lib/format";
import { toCsv } from "@/lib/labor/payroll";
import { fmtClockTime, weekdaysLabel } from "@/lib/scheduling/datetime";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("bids");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const db = auth.supabase;

  const { data: cycle } = await db
    .from("bid_cycles")
    .select("id, name, starts_on")
    .eq("id", id)
    .eq("organization_id", auth.org.id)
    .maybeSingle();
  if (!cycle) return new Response("Not found", { status: 404 });

  const { data: awards } = await db
    .from("bid_awards")
    .select(
      "choice_rank, method, reason, created_at, employee:employees!bid_awards_employee_id_fkey(employee_number, first_name, last_name, seniority_number), line:bid_lines(line_number, start_time, end_time, report_time, weekdays, line_type)",
    )
    .eq("cycle_id", id)
    .eq("organization_id", auth.org.id);

  const h24 = auth.settings.clock24h;
  const rows = (awards ?? [])
    .slice()
    .sort((a, b) => (a.line?.line_number ?? 0) - (b.line?.line_number ?? 0) || (a.employee?.seniority_number ?? 1e9) - (b.employee?.seniority_number ?? 1e9))
    .map((a) => [
      a.line?.line_number ?? "",
      a.line ? `${fmtClockTime(a.line.start_time, h24)}-${fmtClockTime(a.line.end_time, h24)}` : "",
      fmtClockTime(a.line?.report_time ?? null, h24),
      a.line ? weekdaysLabel(a.line.weekdays) : "",
      a.line?.line_type ?? "",
      a.employee?.employee_number ?? "",
      a.employee ? fullName(a.employee) : "",
      a.employee?.seniority_number ?? "",
      a.method,
      a.choice_rank ?? "",
      a.reason ?? "",
    ]);
  const csv = toCsv([
    ["Line", "Hours", "Report", "Days", "Type", "Employee number", "Name", "Seniority", "Method", "Choice", "Reason"],
    ...rows,
  ]);
  const slug = cycle.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "bid";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rolecall-bid-awards-${slug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
