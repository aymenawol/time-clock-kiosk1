import { isYmd } from "@/components/records/params";
import { buildReport, isReportKey } from "@/components/records/reports";
import { requireAuth } from "@/lib/auth/session";
import { todayIn } from "@/lib/format";
import { toCsv } from "@/lib/labor/payroll";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth("reports");
  const sp = new URL(request.url).searchParams;
  const today = todayIn(auth.org.timezone);
  const from = isYmd(sp.get("from") ?? "") ? (sp.get("from") as string) : `${today.slice(0, 7)}-01`;
  const to = isYmd(sp.get("to") ?? "") ? (sp.get("to") as string) : today;
  const reportParam = sp.get("report") ?? "hours";
  const key = isReportKey(reportParam) ? reportParam : "hours";
  const report = await buildReport(auth, key, from, to);
  return new Response(toCsv([report.columns, ...report.rows]), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="report-${key}-${from}-to-${to}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
