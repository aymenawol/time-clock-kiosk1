import { AlertTriangle, Bus, CheckCircle2, ClipboardList, Clock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DamageDiagram, type DamageStroke } from "@/components/domain/damage-diagram";
import { findPreviousReport, ITEM_COLUMNS } from "@/components/domain/inspection-data";
import { parseSignature } from "@/lib/signature";
import { getActiveShift } from "@/components/field/data";
import { FieldHeader, Notice } from "@/components/field/field-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { requireAuth } from "@/lib/auth/session";
import { fmtDate, fmtDateTime, fmtTime } from "@/lib/format";
import { fmtWorked, itemsForKind, parseResults, timeWorkedMinutes, type PaperItem } from "@/lib/inspection";
import { InspectionForm, type Answer, type PreMark, type PreviousSummary } from "./inspection-form";

const KINDS = {
  pre_trip: { title: "Pre-trip inspection", short: "pre-trip" },
  post_trip: { title: "Post-trip inspection", short: "post-trip" },
} as const;

const damageSchema = z.array(
  z.object({
    view: z.enum(["front", "rear", "left", "right"]),
    points: z.array(z.tuple([z.number(), z.number()])),
  }),
);

function parseDamage(raw: unknown): DamageStroke[] {
  const r = damageSchema.safeParse(raw);
  return r.success ? r.data : [];
}

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  return { title: kind in KINDS ? KINDS[kind as keyof typeof KINDS].title : "Inspection" };
}

export default async function InspectionPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind: rawKind } = await params;
  if (rawKind !== "pre_trip" && rawKind !== "post_trip") notFound();
  const kind = rawKind;
  const meta = KINDS[kind];

  const auth = await requireAuth("driving");
  const tz = auth.org.timezone;
  const clock24h = auth.settings.clock24h;
  const shift = await getActiveShift(auth);

  if (!shift) {
    return (
      <>
        <FieldHeader title={meta.title} />
        <Card>
          <EmptyState
            icon={Clock}
            title="You are not clocked in"
            description={`Clock in at the kiosk, then come back to do your ${meta.short} inspection.`}
          />
        </Card>
      </>
    );
  }
  if (!shift.vehicle) {
    return (
      <>
        <FieldHeader title={meta.title} />
        <Card>
          <EmptyState
            icon={Bus}
            title="No vehicle assigned yet"
            description="Dispatch has not given you a vehicle. The inspection opens as soon as one is assigned."
          />
        </Card>
      </>
    );
  }

  const [inspRes, itemsRes, preRes] = await Promise.all([
    auth.supabase
      .from("inspections")
      .select(
        "id, vehicle_id, odometer, results, damage, notes, submitted_at, defect_count, updated_at, operator_signature, reviewed_inspection_id, vehicle:vehicles(number)",
      )
      .eq("organization_id", auth.org.id)
      .eq("shift_id", shift.id)
      .eq("kind", kind)
      .maybeSingle(),
    auth.supabase
      .from("checklist_items")
      .select(ITEM_COLUMNS)
      .eq("organization_id", auth.org.id)
      .eq("active", true)
      .order("sort"),
    kind === "post_trip"
      ? auth.supabase
          .from("inspections")
          .select("odometer, results")
          .eq("organization_id", auth.org.id)
          .eq("shift_id", shift.id)
          .eq("kind", "pre_trip")
          .maybeSingle()
      : null,
  ]);

  if (inspRes.error || itemsRes.error) {
    return (
      <>
        <FieldHeader title={meta.title} />
        <Notice tone="danger" icon={AlertTriangle} role="alert" title="The inspection could not be loaded">
          Check your connection and refresh the page.
        </Notice>
      </>
    );
  }

  const inspection = inspRes.data;
  const results = parseResults(inspection?.results);

  // Submitted: read-only summary.
  if (inspection?.submitted_at) {
    const failed = results.filter((r) => r.mark === "x");
    const passed = results.filter((r) => r.mark === "ok" || r.mark === "na").length;
    const damage = parseDamage(inspection.damage);
    return (
      <>
        <FieldHeader title={meta.title} description={`Vehicle ${inspection.vehicle?.number ?? shift.vehicle.number}`} />
        <div className="flex flex-col gap-4">
          <Notice
            tone={failed.some((f) => f.critical) ? "danger" : failed.length ? "warning" : "success"}
            icon={failed.length ? AlertTriangle : CheckCircle2}
            title={`Submitted ${fmtDateTime(inspection.submitted_at, tz, clock24h)}`}
          >
            {failed.length
              ? `${failed.length} defect${failed.length === 1 ? " was" : "s were"} reported to the technicians.${
                  failed.some((f) => f.critical) ? " The vehicle went to the shop." : ""
                }`
              : `All ${passed} items passed.`}
          </Notice>

          <Card>
            <dl className="grid grid-cols-3 divide-x divide-border text-center">
              <div className="px-2 py-3">
                <dt className="text-xs text-muted">OK or NA</dt>
                <dd className="text-2xl font-semibold text-success tabular">{passed}</dd>
              </div>
              <div className="px-2 py-3">
                <dt className="text-xs text-muted">Marked X</dt>
                <dd className={`text-2xl font-semibold tabular ${failed.length ? "text-danger" : "text-fg"}`}>{failed.length}</dd>
              </div>
              <div className="px-2 py-3">
                <dt className="text-xs text-muted">{kind === "pre_trip" ? "Beginning" : "End"} miles</dt>
                <dd className="font-mono text-lg font-semibold text-fg tabular">
                  {inspection.odometer !== null ? inspection.odometer.toLocaleString("en-US") : "-"}
                </dd>
              </div>
            </dl>
          </Card>

          {failed.length ? (
            <Card>
              <CardHeader title="Items marked X" />
              <ul className="divide-y divide-border">
                {failed.map((f) => (
                  <li key={f.item_id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-fg">{f.label}</p>
                      {f.critical ? <Badge tone="danger">Critical</Badge> : null}
                    </div>
                    <p className="text-xs text-muted">{f.category}</p>
                    {f.note ? <p className="mt-1 text-sm text-fg">{f.note}</p> : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {inspection.notes ? (
            <Card>
              <CardHeader title="Operator comments" />
              <CardBody>
                <p className="whitespace-pre-line text-sm text-fg">{inspection.notes}</p>
              </CardBody>
            </Card>
          ) : null}

          {damage.length ? (
            <Card>
              <CardHeader title="Damage" />
              <CardBody>
                <DamageDiagram value={damage} readOnly />
              </CardBody>
            </Card>
          ) : null}

          <Button asChild size="xl" className="w-full">
            <Link href="/m">Back to home</Link>
          </Button>
        </div>
      </>
    );
  }

  const items = (itemsRes.data ?? []) as PaperItem[];
  if (!items.length) {
    return (
      <>
        <FieldHeader title={meta.title} />
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="No checklist yet"
            description="Your organization has not set up an inspection checklist. Ask an admin to add one in Settings."
          />
        </Card>
      </>
    );
  }

  const answers: Record<string, Answer> = {};
  for (const r of results) answers[r.item_id] = { mark: r.mark, psi: r.psi !== null ? String(r.psi) : "", note: r.note ?? "" };

  const preMarks: Record<string, PreMark> = {};
  for (const r of parseResults(preRes?.data?.results)) preMarks[r.item_id] = { mark: r.mark, psi: r.psi };

  // Pre-trip: the latest report on this vehicle by someone else. Drivers can't read
  // other people's inspections through RLS, and this lookup is scoped to the vehicle
  // the caller is clocked in on.
  let previous: PreviousSummary | null = null;
  if (kind === "pre_trip") {
    const prev = await findPreviousReport(auth.supabase, auth.org.id, shift.vehicle.id, auth.employee.id);
    if (prev) {
      previous = {
        id: prev.id,
        operatorName: prev.operatorName,
        when: fmtDateTime(prev.submitted_at, tz, clock24h),
        kindLabel: prev.kind === "pre_trip" ? "pre-trip" : "post-trip",
        xItems: prev.results.filter((r) => r.mark === "x").map((r) => ({ label: r.label, note: r.note })),
        notes: prev.notes,
      };
    }
  }

  const tenEight = shift.in_service_at ? fmtTime(shift.in_service_at, tz, clock24h) : "";
  const header = {
    date: fmtDate(shift.clock_in_at, tz, "MM/dd/yyyy"),
    tenEight,
    operatorName: `${auth.employee.first_name} ${auth.employee.last_name}`,
    beginTime: fmtTime(shift.clock_in_at, tz, clock24h),
    endTime: shift.clock_out_at ? fmtTime(shift.clock_out_at, tz, clock24h) : "",
    timeWorked: fmtWorked(timeWorkedMinutes(shift.clock_in_at, shift.clock_out_at)),
  };
  const vehicleChanged = inspection && inspection.vehicle_id !== shift.vehicle.id;

  return (
    <>
      <FieldHeader
        title={meta.title}
        description={
          <>
            Vehicle <span className="font-medium text-fg">{shift.vehicle.number}</span>
            {inspection ? ` · draft saved ${fmtDateTime(inspection.updated_at, tz, clock24h)}` : ""}
            {kind === "post_trip" ? ` · ${itemsForKind(kind, items).length} items to recheck` : ""}
          </>
        }
      />
      {vehicleChanged ? (
        <Notice tone="warning" icon={AlertTriangle} className="mb-4">
          Your vehicle changed since you started this draft. Saving moves it to vehicle {shift.vehicle.number}.
        </Notice>
      ) : null}
      <InspectionForm
        kind={kind}
        vehicleNumber={shift.vehicle.number}
        header={header}
        lastOdometer={shift.vehicle.odometer}
        preOdometer={preRes?.data?.odometer ?? null}
        items={items}
        preMarks={preMarks}
        previous={previous}
        initial={{
          answers,
          odometer: inspection?.odometer ?? null,
          notes: inspection?.notes ?? "",
          damage: parseDamage(inspection?.damage),
          signature: parseSignature(inspection?.operator_signature),
          reviewed: Boolean(inspection?.reviewed_inspection_id),
        }}
      />
    </>
  );
}
