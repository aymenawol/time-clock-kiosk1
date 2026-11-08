import { ArrowLeft, Download, ListPlus, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/admin/action-buttons";
import { RecordEditor, type FieldDef } from "@/components/admin/record-editor";
import { BID_CYCLE_STATUS, StatusPill } from "@/components/admin/status";
import { UrlTabs } from "@/components/admin/url-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime, fmtLocalDate, fullName } from "@/lib/format";
import { fmtClockTime, toZonedInput, weekdaysLabel } from "@/lib/scheduling/datetime";
import { compareSeniority } from "@/lib/scheduling/seniority";
import { deleteLine, saveLine } from "../actions";
import { AwardPreview, type PreviewEmployee } from "../_components/award-preview";
import { CycleForm } from "../_components/cycle-form";
import { CycleStatusActions } from "../_components/cycle-status-actions";

export const metadata = { title: "Bid cycle" };

const LINE_TYPES = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "shuttle", label: "Shuttle" },
  { value: "other", label: "Other" },
];
const lineTypeLabel = (v: string) => LINE_TYPES.find((t) => t.value === v)?.label ?? v;

export default async function BidCyclePage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("bids");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const tz = auth.org.timezone;
  const h24 = auth.settings.clock24h;
  const db = auth.supabase;
  const org = auth.org.id;

  const { data: cycle } = await db.from("bid_cycles").select("*").eq("id", id).eq("organization_id", org).maybeSingle();
  if (!cycle) notFound();

  const [linesRes, routesRes, prefsRes, awardsRes, peopleRes] = await Promise.all([
    db.from("bid_lines").select("*, route:routes(name)").eq("cycle_id", id).eq("organization_id", org).order("line_number"),
    db.from("routes").select("id, name").eq("organization_id", org).eq("active", true).order("name"),
    db.from("bid_preferences").select("employee_id, line_ids, submitted_at").eq("cycle_id", id).eq("organization_id", org),
    db.from("bid_awards").select("*").eq("cycle_id", id).eq("organization_id", org),
    db
      .from("employees")
      .select("id, employee_number, first_name, last_name, role, status, seniority_number, hire_date")
      .eq("organization_id", org)
      .neq("status", "terminated"),
  ]);
  const lines = linesRes.data ?? [];
  const routes = routesRes.data ?? [];
  const prefs = prefsRes.data ?? [];
  const awards = awardsRes.data ?? [];
  const people = peopleRes.data ?? [];

  const personById = new Map(people.map((p) => [p.id, p]));
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const prefByEmp = new Map(prefs.map((p) => [p.employee_id, p]));
  const seniorityKey = (p: (typeof people)[number]) => ({
    id: p.id,
    seniorityNumber: p.seniority_number,
    hireDate: p.hire_date,
  });

  const activeDrivers = people.filter((p) => p.role === "driver" && p.status === "active");
  const pool = [
    ...new Map(
      [...activeDrivers, ...prefs.map((p) => personById.get(p.employee_id)).filter((p) => p?.status === "active")].map((p) => [
        p!.id,
        p!,
      ]),
    ).values(),
  ];
  const notSubmitted = activeDrivers.filter((d) => !prefByEmp.has(d.id)).sort((a, b) => compareSeniority(seniorityKey(a), seniorityKey(b)));
  const submitted = prefs
    .map((p) => ({ pref: p, person: personById.get(p.employee_id) }))
    .sort((a, b) =>
      a.person && b.person ? compareSeniority(seniorityKey(a.person), seniorityKey(b.person)) : a.person ? -1 : 1,
    );

  const seats = lines.reduce((n, l) => n + l.capacity, 0);
  const isDraft = cycle.status === "draft";
  const lineLabel = (l: (typeof lines)[number]) =>
    `Line ${l.line_number} · ${fmtClockTime(l.start_time, h24)}–${fmtClockTime(l.end_time, h24)} · ${weekdaysLabel(l.weekdays)}`;

  const lineFields: FieldDef[] = [
    { name: "line_number", label: "Line number", type: "number", min: 1, step: 1, required: true },
    { name: "capacity", label: "Seats", type: "number", min: 1, max: 100, step: 1, required: true, hint: "Drivers this line can take." },
    { name: "start_time", label: "Start time", type: "time", required: true },
    { name: "end_time", label: "End time", type: "time", required: true, hint: "Earlier than start means overnight." },
    { name: "report_time", label: "Report time", type: "time" },
    { name: "line_type", label: "Type", type: "select", options: LINE_TYPES, required: true },
    { name: "weekdays", label: "Days worked", type: "weekdays", required: true },
    {
      name: "route_id",
      label: "Route",
      type: "select",
      allowEmpty: "No route",
      options: routes.map((r) => ({ value: r.id, label: r.name })),
    },
    { name: "notes", label: "Notes", type: "textarea", maxLength: 500 },
  ];
  const nextLineNumber = lines.reduce((m, l) => Math.max(m, l.line_number), 0) + 1;

  // Manual awards saved earlier stay as overrides when the preview is rebuilt.
  const initialOverrides = Object.fromEntries(
    awards.filter((a) => a.method === "manual").map((a) => [a.employee_id, { lineId: a.line_id, reason: a.reason ?? "" }]),
  );
  const previewEmployees: PreviewEmployee[] = pool.map((p) => ({
    id: p.id,
    name: fullName(p),
    number: p.employee_number,
    seniorityNumber: p.seniority_number,
    hireDate: p.hire_date,
    choices: prefByEmp.get(p.id)?.line_ids ?? null,
  }));

  const awardsByLine = new Map<string, typeof awards>();
  for (const a of awards) awardsByLine.set(a.line_id, [...(awardsByLine.get(a.line_id) ?? []), a]);

  const defaultTab = { draft: "lines", open: "preferences", closed: "award", awarded: "results" }[cycle.status] ?? "lines";

  const linesTab = (
    <Card>
      <CardHeader
        title="Lines"
        description={isDraft ? "Each line is a recurring shift pattern employees can bid on." : "Lines are locked once bidding opens."}
        actions={
          isDraft ? (
            <RecordEditor
              title="Add line"
              fields={lineFields}
              action={saveLine}
              extra={{ cycle_id: cycle.id }}
              initial={{ line_number: nextLineNumber, capacity: 1, line_type: "full_time", weekdays: [1, 2, 3, 4, 5] }}
              triggerLabel="Add line"
            />
          ) : null
        }
      />
      {lines.length === 0 ? (
        <EmptyState icon={ListPlus} title="No lines yet" description="Add the shift lines employees will rank." />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Line</TH>
              <TH>Hours</TH>
              <TH>Report</TH>
              <TH>Days</TH>
              <TH>Type</TH>
              <TH>Route</TH>
              <TH className="text-right">Seats</TH>
              <TH>Notes</TH>
              {isDraft ? (
                <TH>
                  <span className="sr-only">Actions</span>
                </TH>
              ) : null}
            </tr>
          </THead>
          <TBody>
            {lines.map((l) => (
              <TR key={l.id}>
                <TD className="font-semibold tabular">{l.line_number}</TD>
                <TD className="whitespace-nowrap tabular">
                  {fmtClockTime(l.start_time, h24)} – {fmtClockTime(l.end_time, h24)}
                </TD>
                <TD className="whitespace-nowrap tabular text-muted">{fmtClockTime(l.report_time, h24)}</TD>
                <TD className="whitespace-nowrap">{weekdaysLabel(l.weekdays)}</TD>
                <TD>{lineTypeLabel(l.line_type)}</TD>
                <TD>{l.route?.name ?? <span className="text-muted">-</span>}</TD>
                <TD className="text-right tabular">{l.capacity}</TD>
                <TD className="max-w-56 truncate text-muted" title={l.notes ?? undefined}>
                  {l.notes ?? "-"}
                </TD>
                {isDraft ? (
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      <RecordEditor
                        mode="edit"
                        title={`Edit line ${l.line_number}`}
                        fields={lineFields}
                        action={saveLine}
                        id={l.id}
                        extra={{ cycle_id: cycle.id }}
                        triggerLabel={`Edit line ${l.line_number}`}
                        initial={{
                          line_number: l.line_number,
                          capacity: l.capacity,
                          start_time: l.start_time.slice(0, 5),
                          end_time: l.end_time.slice(0, 5),
                          report_time: l.report_time?.slice(0, 5) ?? "",
                          line_type: l.line_type,
                          weekdays: l.weekdays,
                          route_id: l.route_id ?? "",
                          notes: l.notes ?? "",
                        }}
                      />
                      <DeleteButton
                        action={deleteLine}
                        input={{ id: l.id, cycle_id: cycle.id }}
                        what={`line ${l.line_number}`}
                        description="The line is removed from this draft."
                      />
                    </div>
                  </TD>
                ) : null}
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );

  const preferencesTab = (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader title="Submitted choices" description="Ranked lines per employee, most senior first." />
        {submitted.length === 0 ? (
          <EmptyState icon={Users} title="No bids yet" description={cycle.status === "draft" ? "Open bidding so employees can rank lines." : "Bids appear here as employees submit them."} />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH className="w-16">Sen. #</TH>
                <TH>Employee</TH>
                <TH>Choices</TH>
                <TH>Submitted</TH>
              </tr>
            </THead>
            <TBody>
              {submitted.map(({ pref, person }) => (
                <TR key={pref.employee_id}>
                  <TD className="tabular text-muted">{person?.seniority_number ?? "-"}</TD>
                  <TD className="min-w-40">
                    <p className="font-medium">{person ? fullName(person) : "Former employee"}</p>
                    <p className="text-xs text-muted tabular">
                      #{person?.employee_number ?? "-"}
                      {person?.hire_date ? ` · hired ${fmtLocalDate(person.hire_date, "MMM d, yyyy")}` : ""}
                    </p>
                  </TD>
                  <TD>
                    <ol className="flex flex-wrap gap-1">
                      {pref.line_ids.map((lid, i) => (
                        <li key={`${lid}-${i}`} className="rounded bg-surface-2 px-1.5 py-0.5 text-xs tabular">
                          {i + 1}. Line {lineById.get(lid)?.line_number ?? "?"}
                        </li>
                      ))}
                    </ol>
                  </TD>
                  <TD className="whitespace-nowrap text-muted">{fmtDateTime(pref.submitted_at, tz, h24)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      <Card>
        <CardHeader
          title="Not submitted"
          description={`${notSubmitted.length} of ${activeDrivers.length} active drivers`}
        />
        {notSubmitted.length === 0 ? (
          <CardBody className="text-sm text-muted">Every active driver has bid.</CardBody>
        ) : (
          <ul className="divide-y divide-border">
            {notSubmitted.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate">{fullName(d)}</span>
                <span className="shrink-0 text-xs text-muted tabular">
                  #{d.employee_number} · sen. {d.seniority_number ?? "-"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );

  const awardTab =
    lines.length === 0 ? (
      <Card>
        <EmptyState title="Add lines first" description="There is nothing to award until the cycle has lines." />
      </Card>
    ) : (
      <AwardPreview
        cycleId={cycle.id}
        lines={lines.map((l) => ({ id: l.id, number: l.line_number, label: lineLabel(l), capacity: l.capacity }))}
        employees={previewEmployees}
        initialOverrides={initialOverrides}
        canApply={cycle.status === "closed" || cycle.status === "awarded"}
        alreadyAwarded={cycle.status === "awarded"}
      />
    );

  const resultsTab = (
    <Card>
      <CardHeader
        title="Awarded lines"
        description={
          cycle.awarded_at
            ? `Applied ${fmtDateTime(cycle.awarded_at, tz, h24)} · ${awards.length} of ${seats} seats filled`
            : "No awards have been applied yet."
        }
        actions={
          awards.length ? (
            <Button asChild variant="secondary" size="sm">
              <a href={`/bids/${cycle.id}/export`} download>
                <Download aria-hidden />
                Export CSV
              </a>
            </Button>
          ) : null
        }
      />
      {awards.length === 0 ? (
        <EmptyState title="Nothing awarded" description="Close bidding, review the award preview and apply it." />
      ) : (
        <ul className="divide-y divide-border">
          {lines.map((l) => {
            const list = awardsByLine.get(l.id) ?? [];
            const pct = Math.min(100, Math.round((list.length / l.capacity) * 100));
            return (
              <li key={l.id} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-start">
                <div className="md:w-72 md:shrink-0">
                  <p className="font-medium">{lineLabel(l)}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 w-32 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                      <div className={list.length >= l.capacity ? "h-full bg-success" : "h-full bg-primary"} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-muted tabular">
                      {list.length}/{l.capacity} seats
                    </span>
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                  {list.length === 0 ? <span className="text-sm text-muted">Open</span> : null}
                  {list.map((a) => {
                    const p = personById.get(a.employee_id);
                    return (
                      <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-sm" title={a.reason ?? undefined}>
                        {p ? fullName(p) : "Former employee"}
                        {a.method === "manual" ? (
                          <Badge tone="accent">Manual</Badge>
                        ) : a.method === "auto" ? (
                          <Badge tone="info">Auto</Badge>
                        ) : (
                          <Badge tone="success">#{a.choice_rank}</Badge>
                        )}
                      </span>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );

  const editInitial = {
    name: cycle.name,
    description: cycle.description ?? "",
    starts_on: cycle.starts_on,
    ends_on: cycle.ends_on,
    opens_at: toZonedInput(cycle.opens_at, tz),
    closes_at: toZonedInput(cycle.closes_at, tz),
    max_choices: cycle.max_choices,
  };

  return (
    <>
      <Link href="/bids" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden />
        Shift bids
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {cycle.name}
            <StatusPill map={BID_CYCLE_STATUS} status={cycle.status} />
          </span>
        }
        description={
          <>
            Schedule {fmtLocalDate(cycle.starts_on, "MMM d, yyyy")} – {fmtLocalDate(cycle.ends_on, "MMM d, yyyy")} · Bidding{" "}
            {fmtDateTime(cycle.opens_at, tz, h24)} – {fmtDateTime(cycle.closes_at, tz, h24)} · Up to {cycle.max_choices} choices
          </>
        }
        actions={
          <>
            {cycle.status === "draft" || cycle.status === "open" ? <CycleForm id={cycle.id} initial={editInitial} timeZone={tz} /> : null}
            <CycleStatusActions id={cycle.id} status={cycle.status} lineCount={lines.length} bidCount={prefs.length} />
          </>
        }
      />
      {cycle.description ? <p className="-mt-2 mb-5 max-w-3xl text-sm text-muted">{cycle.description}</p> : null}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Lines" value={lines.length} />
        <Stat label="Seats" value={seats} />
        <Stat label="Bids received" value={prefs.length} hint={`${activeDrivers.length} active drivers`} />
        <Stat
          label="Awarded"
          value={awards.length}
          tone={cycle.status === "awarded" ? "success" : undefined}
          hint={cycle.status === "awarded" ? "Applied" : "Not applied yet"}
        />
      </div>
      <UrlTabs
        defaultTab={defaultTab}
        tabs={[
          { value: "lines", label: `Lines (${lines.length})`, content: linesTab },
          { value: "preferences", label: `Preferences (${prefs.length})`, content: preferencesTab },
          { value: "award", label: "Award", content: awardTab },
          { value: "results", label: "Results", content: resultsTab },
        ]}
      />
    </>
  );
}
