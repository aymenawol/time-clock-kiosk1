import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActiveShift } from "@/components/field/data";
import { FieldHeader } from "@/components/field/field-header";
import { findPreviousReport, loadInspectionSheet } from "@/components/domain/inspection-data";
import { InspectionSheet } from "@/components/domain/inspection-sheet";
import { PrintButton } from "@/components/domain/print-button";
import { TechnicianSignoff } from "@/components/domain/technician-signoff";
import { can } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Vehicle inspection" };

/**
 * The paper sheet for the field app. Technicians (and supervisors and admins)
 * read any inspection and sign it. A driver can read only the previous
 * operator's report for the vehicle they are clocked in on.
 */
export default async function FieldInspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const auth = await requireAuth("field");
  const staff = can(auth.employee.role, "defectsWork");

  const db = auth.supabase;
  if (!staff) {
    // A driver may open their own reports and the previous operator's report for the vehicle they are on.
    // RLS enforces both (inspections_select_current_vehicle); this keeps older reports of that vehicle out.
    const shift = await getActiveShift(auth);
    const prev = shift?.vehicle ? await findPreviousReport(db, auth.org.id, shift.vehicle.id, auth.employee.id) : null;
    const { data: own } = await db.from("inspections").select("id").eq("id", id).eq("employee_id", auth.employee.id).maybeSingle();
    if (!own && prev?.id !== id) notFound();
  }

  const data = await loadInspectionSheet(db, auth.org.id, id);
  if (!data) notFound();

  const signTarget = [data.pre, data.post].find((r) => r?.submitted_at) ?? null;
  const signed = Boolean(data.pre?.technician_signed_at || data.post?.technician_signed_at);

  return (
    <>
      <div className="print:hidden">
        <FieldHeader
          title="Vehicle inspection"
          description={`Vehicle ${data.vehicle?.number ?? "-"}`}
          back={staff ? "/m" : "/m/inspection/pre_trip"}
          backLabel={staff ? "Home" : "Pre-trip"}
          actions={<PrintButton />}
        />
      </div>
      <InspectionSheet
        data={data}
        timeZone={auth.org.timezone}
        clock24h={auth.settings.clock24h}
        signoff={staff && signTarget && !signed ? <TechnicianSignoff inspectionId={signTarget.id} /> : undefined}
      />
    </>
  );
}
