import { FileSpreadsheet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PaperSheet } from "@/components/counts/paper-sheet";
import { CountPrintStyles } from "@/components/counts/print-styles";
import { loadCountSheets, parseRows } from "@/components/records/counts-query";
import { CountSheetEditor } from "@/components/records/count-sheet-editor";
import { CsvLink } from "@/components/records/download-button";
import { FilterField, FilterForm } from "@/components/records/filter-form";
import { param, type SearchParams, ymdOr } from "@/components/records/params";
import { loadPeople } from "@/components/records/people";
import { LiveRefresh } from "@/components/realtime/use-live-refresh";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { can } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { entryRowCount, fmtPaperTime, formatBreakWindows, lastFirst, stampLabel } from "@/lib/counts/sheet";
import { fmtDateTime, fmtLocalDate, fmtTime, todayIn } from "@/lib/format";
import { PrintButton } from "./_components/print-button";

export const metadata: Metadata = { title: "Counting Sheets" };

export default async function CountsPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireAuth("counts");
  const sp = await searchParams;
  const tz = auth.org.timezone;
  const c24 = auth.settings.clock24h;
  const date = ymdOr(param(sp, "date"), todayIn(tz));
  const { sheets, columns, shiftById, breaksByShift, vehicleNumber, routeName } = await loadCountSheets(auth, date);
  const people = await loadPeople(auth);
  const canEdit = can(auth.employee.role, "countsEdit");
  const slogan = auth.settings.counts.slogan;

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

  return (
    <>
      <CountPrintStyles />
      <LiveRefresh organizationId={auth.org.id} tables={["shifts"]} />
      <div className="print:hidden">
        <PageHeader
          title="Counting Sheets"
          description={`${fmtLocalDate(date, "EEEE, MMM d")}: ${sheets.length} sheet${sheets.length === 1 ? "" : "s"}`}
          actions={
            sheets.length ? (
              <>
                <CsvLink href={`/counts/export?date=${date}`} />
                <PrintButton />
              </>
            ) : undefined
          }
        />
        <FilterForm clearHref="/counts">
          <FilterField label="Date">
            <Input type="date" name="date" defaultValue={date} />
          </FilterField>
        </FilterForm>
      </div>

      {sheets.length === 0 ? (
        <Card className="print:hidden">
          <EmptyState icon={FileSpreadsheet} title="No counting sheets" description="No driver started a sheet on this date." />
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {sheets.map((s) => {
            const parsed = parseRows(s.rows);
            const rows = Array.from({ length: entryRowCount(parsed.length) }, (_, i) => parsed[i] ?? { departure_time: "", counts: {} });
            const revs = revisionsBySheet.get(s.id) ?? [];
            const emp = people.byId.get(s.employee_id);
            const sh = shiftById.get(s.shift_id);
            const bus = s.vehicle_id ? (vehicleNumber.get(s.vehicle_id) ?? "") : "";
            const plannedEnd = sh
              ? (sh.scheduled_end ?? new Date(new Date(sh.clock_in_at).getTime() + auth.settings.breaks.defaultShiftMinutes * 60_000).toISOString())
              : null;
            const title = `${people.name(s.employee_id)}, vehicle ${bus || "-"}`;
            return (
              <section key={s.id} className="paper-wrap mx-auto flex w-full max-w-4xl flex-col gap-2" aria-label={`Counting sheet, ${title}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {people.name(s.employee_id)}
                      <Badge tone={s.status === "submitted" ? "success" : "warning"}>{s.status === "submitted" ? "Submitted" : "In progress"}</Badge>
                    </p>
                    <p className="text-sm text-muted">
                      {s.vehicle_id ? (
                        <Link href={`/fleet/${s.vehicle_id}`} className="hover:underline">
                          Vehicle {bus || "-"}
                        </Link>
                      ) : (
                        "No vehicle"
                      )}
                      {" · "}
                      {s.route_id ? (routeName.get(s.route_id) ?? "-") : "No route"}
                      {" · "}Start time {fmtTime(s.created_at, tz, c24)}
                      {" · "}End time {s.submitted_at ? fmtTime(s.submitted_at, tz, c24) : "-"}
                    </p>
                  </div>
                  {canEdit && s.status === "submitted" ? (
                    <CountSheetEditor
                      sheetId={s.id}
                      title={title}
                      columns={columns.map((c) => ({ id: c.id, name: c.heading }))}
                      rows={parsed.filter((r) => r.departure_time || Object.values(r.counts).some((n) => n > 0))}
                    />
                  ) : null}
                </div>
                <PaperSheet
                  slogan={slogan}
                  header={{
                    operator: emp ? lastFirst(emp) : "",
                    start: fmtPaperTime(sh ? (sh.scheduled_start ?? sh.clock_in_at) : null, tz, c24),
                    end: fmtPaperTime(plannedEnd, tz, c24),
                    date: fmtLocalDate(s.work_date, "MM/dd/yy"),
                    bus,
                    breakWindows: formatBreakWindows(breaksByShift.get(s.shift_id) ?? [], tz),
                    checkIn: stampLabel(sh?.clock_in_at, tz, c24),
                    checkOut: stampLabel(sh?.clock_out_at, tz, c24),
                  }}
                  columns={columns}
                  rows={rows}
                />
                {revs.length ? (
                  <p className="text-xs text-muted print:hidden">
                    Edited {revs.length} time{revs.length === 1 ? "" : "s"}. Latest by {people.name(revs[0].edited_by)},{" "}
                    {fmtDateTime(revs[0].created_at, tz, c24)}: {revs[0].reason}
                  </p>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
