import { FieldHeader } from "@/components/field/field-header";
import { LiveRefresh } from "@/components/realtime/use-live-refresh";
import { requireAuth } from "@/lib/auth/session";
import { FuelQueue } from "./fuel-queue";

export const metadata = { title: "Fuel and wash" };

export default async function FuelPage() {
  const auth = await requireAuth("fuelQueue");
  return (
    <>
      <LiveRefresh organizationId={auth.org.id} tables={["vehicles"]} />
      <FieldHeader title="Fuel and wash" description="Vehicles waiting for fuel, a wash or a charge." />
      <FuelQueue auth={auth} />
    </>
  );
}
