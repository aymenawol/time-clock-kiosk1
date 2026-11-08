import { FieldHeader } from "@/components/field/field-header";
import { LiveRefresh } from "@/components/realtime/use-live-refresh";
import { requireAuth } from "@/lib/auth/session";
import { DefectQueue } from "./defect-queue";

export const metadata = { title: "Defects" };

export default async function DefectsPage() {
  const auth = await requireAuth("defectQueue");
  return (
    <>
      <LiveRefresh organizationId={auth.org.id} tables={["defects", "vehicles"]} />
      <FieldHeader title="Defects" description="Critical defects first. Fix, defer or report new ones." />
      <DefectQueue auth={auth} />
    </>
  );
}
