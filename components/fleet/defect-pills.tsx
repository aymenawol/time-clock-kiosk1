import { Badge, type Tone } from "@/components/ui/badge";
import { DEFECT_STATUS_LABEL, SEVERITY_LABEL } from "./energy";

const SEV_TONE: Record<string, Tone> = { minor: "neutral", major: "warning", critical: "danger" };
const STATUS_TONE: Record<string, Tone> = { open: "danger", in_progress: "primary", deferred: "warning", resolved: "success" };

export function SeverityPill({ severity }: { severity: string }) {
  return <Badge tone={SEV_TONE[severity] ?? "neutral"}>{SEVERITY_LABEL[severity] ?? severity}</Badge>;
}

export function DefectStatusPill({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? "neutral"} dot>
      {DEFECT_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
