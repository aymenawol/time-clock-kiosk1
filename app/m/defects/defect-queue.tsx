import { DEFECT_STATUS_ORDER, SEVERITY_ORDER } from "@/components/field/rules";
import { Card } from "@/components/ui/card";
import type { AuthContext } from "@/lib/auth/session";
import { fmtAgo, fullName } from "@/lib/format";
import { DefectList, type QueueDefect } from "./_components/defect-list";
import { ReportDefectButton } from "./_components/report-defect";

const PHOTO_URL_SECONDS = 60 * 60;

/** Open, in-progress and deferred defects for technicians. Used by /m and /m/defects. */
export async function DefectQueue({ auth }: { auth: AuthContext }) {
  const [defectsRes, vehiclesRes, checklistRes] = await Promise.all([
    auth.supabase
      .from("defects")
      .select(
        "id, vehicle_id, category, item, description, severity, status, created_at, photo_paths, resolution_note, inspection_id, assigned_to, vehicle:vehicles(id, number, status), reporter:employees!defects_reported_by_fkey(first_name, last_name), assignee:employees!defects_assigned_to_fkey(first_name, last_name)",
      )
      .eq("organization_id", auth.org.id)
      .in("status", ["open", "in_progress", "deferred"])
      .order("created_at", { ascending: true })
      .limit(300),
    auth.supabase
      .from("vehicles")
      .select("id, number, status")
      .eq("organization_id", auth.org.id)
      .eq("active", true)
      .order("number"),
    auth.supabase.from("checklist_items").select("category").eq("organization_id", auth.org.id).eq("active", true),
  ]);

  if (defectsRes.error) {
    return (
      <Card role="alert" className="p-4 text-sm text-danger">
        The defect queue could not be loaded. Refresh the page to try again.
      </Card>
    );
  }

  const rows = defectsRes.data ?? [];
  const paths = rows.flatMap((d) => d.photo_paths);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await auth.supabase.storage.from("defect-photos").createSignedUrls(paths, PHOTO_URL_SECONDS);
    for (const s of data ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  const defects: QueueDefect[] = rows
    .map((d) => {
      // Other serious defects still open on the same vehicle keep it out of service.
      const blocking = rows.filter(
        (o) =>
          o.id !== d.id &&
          o.vehicle_id === d.vehicle_id &&
          (o.status === "open" || o.status === "in_progress") &&
          (o.severity === "critical" || o.severity === "major"),
      ).length;
      return {
        id: d.id,
        category: d.category,
        item: d.item,
        description: d.description,
        severity: d.severity,
        status: d.status,
        createdAt: d.created_at,
        ago: fmtAgo(d.created_at),
        fromInspection: d.inspection_id !== null,
        note: d.resolution_note,
        assignedToMe: d.assigned_to === auth.employee.id,
        assignee: d.assignee ? fullName(d.assignee) : null,
        reporter: d.reporter ? fullName(d.reporter) : null,
        vehicle: d.vehicle,
        blocking,
        photos: d.photo_paths.map((p) => ({ path: p, url: urls.get(p) ?? null })),
      };
    })
    .sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) ||
        (DEFECT_STATUS_ORDER[a.status] ?? 9) - (DEFECT_STATUS_ORDER[b.status] ?? 9) ||
        a.createdAt.localeCompare(b.createdAt),
    );

  const categories = [...new Set((checklistRes.data ?? []).map((c) => c.category))].sort();

  return (
    <section aria-labelledby="defect-queue-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="defect-queue-title" className="text-sm font-semibold uppercase tracking-wide text-muted">
          Defect queue{defects.length ? ` · ${defects.length}` : ""}
        </h2>
        <ReportDefectButton vehicles={vehiclesRes.data ?? []} categories={categories} />
      </div>
      <DefectList defects={defects} organizationId={auth.org.id} />
    </section>
  );
}
