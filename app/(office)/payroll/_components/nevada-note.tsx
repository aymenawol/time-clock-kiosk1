import { Scale } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function NevadaNote({ minimumWageCents, weekStartsOn, multiplier }: { minimumWageCents: number; weekStartsOn: number; multiplier: number }) {
  return (
    <Card>
      <CardBody className="flex gap-3 text-sm text-muted">
        <Scale className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="font-medium text-fg">How overtime is counted (Nevada, NRS 608.018)</p>
          <p>
            Daily overtime applies only to employees paid less than 1.5 times the minimum wage (currently below{" "}
            {((minimumWageCents * 1.5) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} an hour), for hours over 8 in a
            24-hour workday. Weekly overtime is hours over 40 in each workweek, which starts on {DAYS[weekStartsOn]}. Hours already paid as daily
            overtime don&apos;t count again toward the 40. Overtime is paid at {multiplier} times the rate. Change these in Settings, Labor rules.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
