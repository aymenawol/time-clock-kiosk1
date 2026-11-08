import { AlertTriangle, Bus, CheckCircle2, ClipboardList, Clock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DamageDiagram, type DamageStroke } from "@/components/domain/damage-diagram";
import { getActiveShift } from "@/components/field/data";
import { FieldHeader, Notice } from "@/components/field/field-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime } from "@/lib/format";
import { InspectionForm } from "./inspection-form";

const KINDS = {
  pre_trip: { title: "Pre-trip inspection", short: "pre-trip" },
  post_trip: { title: "Post-trip inspection", short: "post-trip" },
} as const;

const resultSchema = z.array(
  z.object({
    item_id: z.string(),
    category: z.string().catch("General"),
    label: z.string().catch("Item"),
    critical: z.boolean().catch(false),
    ok: z.boolean().nullable().catch(null),
    note: z.string().nullable().catch(null),
  }),
);
const damageSchema = z.array(
  z.object({
    view: z.enum(["front", "rear", "left", "right"]),
    points: z.array(z.tuple([z.number(), z.number()])),
  }),
);

function parseResults(raw: unknown) {
  const r = resultSchema.safeParse(raw);
  return r.success ? r.data : [];
}
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
      .select("id, vehicle_id, odometer, results, damage, notes, submitted_at, defect_count, updated_at, vehicle:vehicles(number)")
      .eq("organization_id", auth.org.id)
      .eq("shift_id", shift.id)
      .eq("kind", kind)
      .maybeSingle(),
    auth.supabase
      .from("checklist_items")
      .select("id, category, label, critical")
      .eq("organization_id", auth.org.id)
      .eq("active", true)
      .order("sort"),
    kind === "post_trip"
      ? auth.supabase
          .from("inspections")
          .select("odometer")
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
    const failed = results.filter((r) => r.ok === false);
    const passed = results.filter((r) => r.ok === true).length;
    const damage = parseDamage(inspection.damage);
    return (
      <>
        <FieldHeader title={meta.title} description={`Vehicle ${inspection.vehicle?.number ?? shift.vehicle.number}`} />
        <div className="flex flex-col gap-4">
          <Notice
            tone={failed.some((f) => f.critical) ? "danger" : failed.length ? "warning" : "success"}
            icon={failed.length ? AlertTriangle : CheckCircle2}
            title={`Submitted ${fmtDateTime(inspection.submitted_at, tz, auth.settings.clock24h)}`}
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
                <dt className="text-xs text-muted">Passed</dt>
                <dd className="text-2xl font-semibold text-success tabular">{passed}</dd>
              </div>
              <div className="px-2 py-3">
                <dt className="text-xs text-muted">Failed</dt>
                <dd className={`text-2xl font-semibold tabular ${failed.length ? "text-danger" : "text-fg"}`}>{failed.length}</dd>
              </div>
              <div className="px-2 py-3">
                <dt className="text-xs text-muted">{kind === "pre_trip" ? "Beginning" : "Ending"} mileage</dt>
                <dd className="font-mono text-lg font-semibold text-fg tabular">
                  {inspection.odometer !== null ? inspection.odometer.toLocaleString("en-US") : "-"}
                </dd>
              </div>
            </dl>
          </Card>

          {failed.length ? (
            <Card>
              <CardHeader title="Failed items" />
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
              <CardHeader title="Notes" />
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

  const items = itemsRes.data ?? [];
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

  const answers: Record<string, { ok: boolean | null; note: string }> = {};
  for (const r of results) answers[r.item_id] = { ok: r.ok, note: r.note ?? "" };
  const vehicleChanged = inspection && inspection.vehicle_id !== shift.vehicle.id;

  return (
    <>
      <FieldHeader
        title={meta.title}
        description={
          <>
            Vehicle <span className="font-medium text-fg">{shift.vehicle.number}</span>
            {inspection ? ` · draft saved ${fmtDateTime(inspection.updated_at, tz, auth.settings.clock24h)}` : ""}
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
        lastOdometer={shift.vehicle.odometer}
        preOdometer={preRes?.data?.odometer ?? null}
        items={items}
        initial={{
          answers,
          odometer: inspection?.odometer ?? null,
          notes: inspection?.notes ?? "",
          damage: parseDamage(inspection?.damage),
        }}
      />
    </>
  );
}
