import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/session";
import { GeneralForm } from "./_components/general-form";

export default async function GeneralSettingsPage() {
  const auth = await requireAuth("settings");
  return (
    <Card>
      <CardHeader title="General" description="Name, time zone and how weeks and clocks are shown." />
      <CardBody>
        <GeneralForm
          initial={{
            name: auth.org.name,
            timezone: auth.org.timezone,
            workweekStartsOn: auth.settings.workweekStartsOn,
            clock24h: auth.settings.clock24h,
          }}
        />
      </CardBody>
    </Card>
  );
}
