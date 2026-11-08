import { BarChart3 } from "lucide-react";
import type { Metadata } from "next";
import { CsvLink } from "@/components/records/download-button";
import { FilterField, FilterForm } from "@/components/records/filter-form";
import { isYmd, param, qs, type SearchParams } from "@/components/records/params";
import { buildReport, isReportKey, REPORTS, type ReportKey } from "@/components/records/reports";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/session";
import { fmtLocalDate, todayIn } from "@/lib/format";

export const metadata: Metadata = { title: "Reports" };

const SHOWN = 500;

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireAuth("reports");
  const sp = await searchParams;
  const today = todayIn(auth.org.timezone);
  const from = isYmd(param(sp, "from")) ? param(sp, "from") : `${today.slice(0, 7)}-01`;
  const to = isYmd(param(sp, "to")) ? param(sp, "to") : today;
  const key: ReportKey = isReportKey(param(sp, "report")) ? (param(sp, "report") as ReportKey) : "hours";
  const report = await buildReport(auth, key, from, to);

  return (
    <>
      <PageHeader
        title="Reports"
        description={`${fmtLocalDate(from, "MMM d, yyyy")} to ${fmtLocalDate(to, "MMM d, yyyy")}`}
        actions={<CsvLink href={`/reports/export${qs({ report: key, from, to })}`} />}
      />
      <FilterForm clearHref="/reports">
        <FilterField label="Report" className="min-w-52">
          <Select name="report" defaultValue={key}>
            {Object.entries(REPORTS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="From">
          <Input type="date" name="from" defaultValue={from} />
        </FilterField>
        <FilterField label="To">
          <Input type="date" name="to" defaultValue={to} />
        </FilterField>
      </FilterForm>

      <Card>
        <CardHeader title={report.title} description={`${report.rows.length} row${report.rows.length === 1 ? "" : "s"}`} />
        {report.notes.length > 0 ? (
          <div className="border-b border-border px-4 py-2 text-xs text-muted">
            {report.notes.map((n) => (
              <p key={n}>{n}</p>
            ))}
          </div>
        ) : null}
        {report.rows.length === 0 ? (
          <EmptyState icon={BarChart3} title="No data" description="Nothing was recorded in this date range." />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  {report.columns.map((c, i) => (
                    <TH key={c} className={report.numeric.includes(i) ? "text-right" : undefined}>
                      {c}
                    </TH>
                  ))}
                </tr>
              </THead>
              <TBody>
                {report.rows.slice(0, SHOWN).map((row, r) => (
                  <TR key={r}>
                    {row.map((cell, i) => (
                      <TD key={i} className={report.numeric.includes(i) ? "text-right tabular" : undefined}>
                        {cell === null || cell === "" ? <span className="text-muted">-</span> : typeof cell === "number" && !Number.isInteger(cell) ? cell.toFixed(2) : cell}
                      </TD>
                    ))}
                  </TR>
                ))}
              </TBody>
            </Table>
            {report.rows.length > SHOWN ? (
              <p className="border-t border-border px-4 py-3 text-sm text-muted">
                Showing the first {SHOWN} rows. Export the CSV for all {report.rows.length}.
              </p>
            ) : null}
          </>
        )}
      </Card>
    </>
  );
}
