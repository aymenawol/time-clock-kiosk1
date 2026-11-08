import { createHash } from "node:crypto";
import { requireAuth } from "@/lib/auth/session";
import { toCsv } from "@/lib/labor/payroll";
import { payrollDayCsvRows } from "@/lib/scheduling/payroll-days";
import { loadPeriodData } from "../../_lib/load";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("payroll");
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });

  const { data: period } = await auth.supabase
    .from("pay_periods")
    .select("id, starts_on, ends_on")
    .eq("id", id)
    .eq("organization_id", auth.org.id)
    .maybeSingle();
  if (!period) return new Response("Not found", { status: 404 });

  const data = await loadPeriodData(auth, period);
  const rows = payrollDayCsvRows(data.days, period.starts_on, period.ends_on);
  const csv = toCsv(rows);
  const sha256 = createHash("sha256").update(csv).digest("hex");

  const { error } = await auth.supabase.from("payroll_exports").insert({
    organization_id: auth.org.id,
    pay_period_id: period.id,
    exported_by: auth.employee.id,
    row_count: rows.length - 1,
    sha256,
  });
  if (error) console.error("[payroll export]", error);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payroll_${period.starts_on}_${period.ends_on}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
