import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadInspectionSheet } from "@/components/domain/inspection-data";
import { InspectionSheet } from "@/components/domain/inspection-sheet";
import { PrintButton } from "@/components/domain/print-button";
import { TechnicianSignoff } from "@/components/domain/technician-signoff";
import { DefectStatusPill, SeverityPill } from "@/components/fleet/defect-pills";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { can } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime } from "@/lib/format";
import { countX, parseResults } from "@/lib/inspection";

export const metadata: Metadata = { title: "Inspection" };

export default async function InspectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("inspections");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, org, settings } = auth;

  const data = await loadInspectionSheet(supabase, org.id, id);
  if (!data) notFound();
  const { primary, pre, post, vehicle, names } = data;

  const { data: defects } = await supabase
    .from("defects")
    .select("*")
    .in("inspection_id", [pre?.id, post?.id].filter((x): x is string => Boolean(x)))
    .eq("organization_id", org.id)
    .order("created_at");

  const failed = countX(parseResults(pre?.results)) + countX(parseResults(post?.results));
  const signTarget = [pre, post].find((r) => r?.submitted_at) ?? null;
  const signed = Boolean(pre?.technician_signed_at || post?.technician_signed_at);
  const canSign = can(auth.employee.role, "defectsWork") && signTarget && !signed;
  const submitted = Boolean(primary.submitted_at ?? post?.submitted_at);

  return (
    <>
      <div className="print:hidden">
        <Button asChild variant="link" className="mb-2">
          <Link href="/fleet/inspections">
            <ArrowLeft aria-hidden /> All inspections
          </Link>
        </Button>
        <PageHeader
          title="Vehicle inspection"
          description={
            <>
              Vehicle{" "}
              <Link href={`/fleet/${primary.vehicle_id}`} className="font-medium text-primary hover:underline">
                {vehicle?.number ?? "-"}
              </Link>
              , {names[primary.employee_id] ?? "-"}, {fmtDateTime(primary.submitted_at ?? primary.created_at, org.timezone, settings.clock24h)}
            </>
          }
          actions={
            <>
              {submitted ? <Badge tone="success">Submitted</Badge> : <Badge tone="warning">Draft</Badge>}
              <Badge tone={failed ? "danger" : "success"}>{failed ? `${failed} marked X` : "No defects"}</Badge>
              {signed ? <Badge tone="info">Signed by technician</Badge> : null}
              <PrintButton />
            </>
          }
        />
      </div>

      <InspectionSheet
        data={data}
        timeZone={org.timezone}
        clock24h={settings.clock24h}
        signoff={canSign && signTarget ? <TechnicianSignoff inspectionId={signTarget.id} /> : undefined}
      />

      <div className="mx-auto mt-4 max-w-5xl print:hidden">
        <Card>
          <CardHeader title={`Defects (${(defects ?? []).length})`} />
          {(defects ?? []).length === 0 ? (
            <CardBody className="text-sm text-muted">No defects came from this inspection.</CardBody>
          ) : (
            <ul className="divide-y divide-border">
              {(defects ?? []).map((d) => (
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
    </>
  );
}
