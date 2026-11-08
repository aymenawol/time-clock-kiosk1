import { ArrowLeft, Check, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DamageDiagram, type DamageStroke } from "@/components/domain/damage-diagram";
import { DefectStatusPill, SeverityPill } from "@/components/fleet/defect-pills";
import { loadPeople } from "@/components/records/people";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Inspection" };

interface ResultItem {
  category?: string;
  label?: string;
  ok?: boolean | null;
  critical?: boolean;
  note?: string | null;
}

export default async function InspectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("inspections");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, org, settings } = auth;

  const { data: inspection } = await supabase
    .from("inspections")
    .select("*")
    .eq("id", id)
    .eq("organization_id", org.id)
    .maybeSingle();
  if (!inspection) notFound();

  const [vehicleRes, defectsRes, people] = await Promise.all([
    supabase.from("vehicles").select("id, number").eq("id", inspection.vehicle_id).maybeSingle(),
    supabase.from("defects").select("*").eq("inspection_id", id).eq("organization_id", org.id).order("created_at"),
    loadPeople(auth),
  ]);

  const results = (Array.isArray(inspection.results) ? inspection.results : []) as unknown as ResultItem[];
  const groups = new Map<string, ResultItem[]>();
  for (const r of results) {
    const key = r.category ?? "General";
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const failed = results.filter((r) => r.ok === false).length;
  const damage = (Array.isArray(inspection.damage) ? inspection.damage : []) as unknown as DamageStroke[];

  return (
    <>
      <Button asChild variant="link" className="mb-2">
        <Link href="/fleet/inspections">
          <ArrowLeft aria-hidden /> All inspections
        </Link>
      </Button>
      <PageHeader
        title={`${inspection.kind === "pre_trip" ? "Pre-trip" : "Post-trip"} inspection`}
        description={
          <>
            Vehicle{" "}
            <Link href={`/fleet/${inspection.vehicle_id}`} className="font-medium text-primary hover:underline">
              {vehicleRes.data?.number ?? "-"}
            </Link>
            , {people.name(inspection.employee_id)}, {fmtDateTime(inspection.submitted_at ?? inspection.created_at, org.timezone, settings.clock24h)}
          </>
        }
        actions={
          <>
            {inspection.submitted_at ? <Badge tone="success">Submitted</Badge> : <Badge tone="warning">Draft</Badge>}
            <Badge tone={failed ? "danger" : "success"}>{failed ? `${failed} failed` : "All passed"}</Badge>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {[...groups.entries()].map(([category, items]) => (
            <Card key={category}>
              <CardHeader title={category} />
              <ul className="divide-y divide-border">
                {items.map((r, i) => (
                  <li key={i} className="flex items-start gap-3 px-4 py-2.5">
                    <span
                      className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full ${
                        r.ok === false ? "bg-danger-soft text-danger" : r.ok ? "bg-success-soft text-success" : "bg-surface-2 text-muted"
                      }`}
                    >
                      {r.ok === false ? <X className="size-3" aria-label="Fail" /> : r.ok ? <Check className="size-3" aria-label="Pass" /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-fg">
                        {r.label}
                        {r.critical ? <span className="ml-2 text-xs font-medium text-danger">Critical</span> : null}
                      </p>
                      {r.note ? <p className="mt-0.5 text-sm text-muted">{r.note}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
          {results.length === 0 ? (
            <Card>
              <CardBody className="text-sm text-muted">No checklist results were recorded.</CardBody>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="flex flex-col gap-2 text-sm">
              <p>
                <span className="text-muted">Odometer: </span>
                {inspection.odometer?.toLocaleString("en-US") ?? "-"}
              </p>
              <p className="whitespace-pre-wrap">
                <span className="text-muted">Notes: </span>
                {inspection.notes ?? "-"}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Damage" />
            <CardBody>
              <DamageDiagram value={damage} readOnly />
              {damage.length === 0 ? <p className="mt-2 text-sm text-muted">No damage was marked.</p> : null}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={`Defects (${(defectsRes.data ?? []).length})`} />
            {(defectsRes.data ?? []).length === 0 ? (
              <CardBody className="text-sm text-muted">No defects came from this inspection.</CardBody>
            ) : (
              <ul className="divide-y divide-border">
                {(defectsRes.data ?? []).map((d) => (
                  <li key={d.id} className="flex flex-col gap-1 px-4 py-2.5">
                    <Link href={`/fleet/defects?vehicle=${d.vehicle_id}`} className="text-sm font-medium text-primary hover:underline">
                      {d.item}
                    </Link>
                    <div className="flex gap-2">
                      <SeverityPill severity={d.severity} />
                      <DefectStatusPill status={d.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
