import { FileSpreadsheet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CountSheetEditor } from "@/components/records/count-sheet-editor";
import { loadCountSheets, parseRows, rowTotal } from "@/components/records/counts-query";
import { CsvLink } from "@/components/records/download-button";
import { FilterField, FilterForm } from "@/components/records/filter-form";
import { param, type SearchParams, ymdOr } from "@/components/records/params";
import { loadPeople } from "@/components/records/people";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { LiveRefresh } from "@/components/realtime/use-live-refresh";
import { can } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime, fmtLocalDate, todayIn } from "@/lib/format";

export const metadata: Metadata = { title: "Counting Sheets" };

export default async function CountsPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireAuth("counts");
  const sp = await searchParams;
  const date = ymdOr(param(sp, "date"), todayIn(auth.org.timezone));
  const { sheets, columns, vehicleNumber, routeName } = await loadCountSheets(auth, date);
  const people = await loadPeople(auth);
  const columnIds = columns.map((c) => c.id);
  const canEdit = can(auth.employee.role, "countsEdit");

  const { data: revisions } = sheets.length
    ? await auth.supabase
        .from("count_sheet_revisions")
        .select("sheet_id, reason, created_at, edited_by")
        .eq("organization_id", auth.org.id)
        .in(
          "sheet_id",
          sheets.map((s) => s.id),
        )
        .order("created_at", { ascending: false })
    : { data: [] };
  const revisionsBySheet = new Map<string, NonNullable<typeof revisions>>();
  for (const r of revisions ?? []) revisionsBySheet.set(r.sheet_id, [...(revisionsBySheet.get(r.sheet_id) ?? []), r]);

  const grand = sheets.reduce((n, s) => n + parseRows(s.rows).reduce((m, r) => m + rowTotal(r, columnIds), 0), 0);

  return (
    <>
      <LiveRefresh organizationId={auth.org.id} tables={["shifts"]} />
      <PageHeader
        title="Counting Sheets"
        description={`${fmtLocalDate(date, "EEEE, MMM d")}: ${sheets.length} sheet${sheets.length === 1 ? "" : "s"}, ${grand} passengers`}
        actions={sheets.length ? <CsvLink href={`/counts/export?date=${date}`} /> : undefined}
      />
      <FilterForm clearHref="/counts">
        <FilterField label="Date">
          <Input type="date" name="date" defaultValue={date} />
        </FilterField>
      </FilterForm>

      {sheets.length === 0 ? (
        <Card>
          <EmptyState icon={FileSpreadsheet} title="No counting sheets" description="No driver started a sheet on this date." />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {sheets.map((s) => {
            const rows = parseRows(s.rows);
            const colTotals = columnIds.map((id) => rows.reduce((n, r) => n + (r.counts[id] ?? 0), 0));
            const revs = revisionsBySheet.get(s.id) ?? [];
            const title = `${people.name(s.employee_id)}, vehicle ${s.vehicle_id ? (vehicleNumber.get(s.vehicle_id) ?? "-") : "-"}`;
            return (
              <Card key={s.id}>
                <CardHeader
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      {people.name(s.employee_id)}
                      <span className="text-sm font-normal text-muted">Total Riders <strong className="tabular text-base text-foreground">{colTotals.reduce((a, b) => a + b, 0)}</strong></span>
                      <Badge tone={s.status === "submitted" ? "success" : "warning"}>{s.status === "submitted" ? "Submitted" : "In progress"}</Badge>
                    </span>
                  }
                  description={
                    <>
                      {s.vehicle_id ? (
                        <Link href={`/fleet/${s.vehicle_id}`} className="hover:underline">
                          Vehicle {vehicleNumber.get(s.vehicle_id) ?? "-"}
                        </Link>
                      ) : (
                        "No vehicle"
                      )}
                      {" · "}
                      {s.route_id ? (routeName.get(s.route_id) ?? "-") : "No route"}
                      {s.submitted_at ? ` · Submitted ${fmtDateTime(s.submitted_at, auth.org.timezone, auth.settings.clock24h)}` : ""}
                    </>
                  }
                  actions={
                    canEdit && s.status === "submitted" ? (
                      <CountSheetEditor sheetId={s.id} title={title} columns={columns} rows={rows} />
                    ) : undefined
                  }
                />
                {rows.length === 0 ? (
                  <EmptyState title="No departures recorded" className="py-8" />
                ) : (
                  <Table>
                    <THead>
                      <tr>
                        <TH>Departure</TH>
                        {columns.map((c) => (
                          <TH key={c.id} className="text-right">
                            {c.name}
                          </TH>
                        ))}
                        <TH className="text-right">Total</TH>
                      </tr>
                    </THead>
                    <TBody>
                      {rows.map((r, i) => (
                        <TR key={i}>
                          <TD className="tabular font-medium">{r.departure_time || "-"}</TD>
                          {columnIds.map((id) => (
                            <TD key={id} className="text-right tabular">
                              {r.counts[id] ?? 0}
                            </TD>
                          ))}
                          <TD className="text-right font-semibold tabular">{rowTotal(r, columnIds)}</TD>
                        </TR>
                      ))}
                      <tr className="bg-surface-2 font-semibold">
                        <TD>Totals</TD>
                        {colTotals.map((t, i) => (
                          <TD key={i} className="text-right tabular">
                            {t}
                          </TD>
                        ))}
                        <TD className="text-right tabular">{colTotals.reduce((a, b) => a + b, 0)}</TD>
                      </tr>
                    </TBody>
                  </Table>
                )}
                {revs.length ? (
                  <p className="border-t border-border px-4 py-2 text-xs text-muted">
                    Edited {revs.length} time{revs.length === 1 ? "" : "s"}. Latest by {people.name(revs[0].edited_by)},{" "}
                    {fmtDateTime(revs[0].created_at, auth.org.timezone, auth.settings.clock24h)}: {revs[0].reason}
                  </p>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
