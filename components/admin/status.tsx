import { Badge, type Tone } from "@/components/ui/badge";

type StatusMap = Record<string, { label: string; tone: Tone }>;

export const BID_CYCLE_STATUS: StatusMap = {
  draft: { label: "Draft", tone: "neutral" },
  open: { label: "Open for bids", tone: "primary" },
  closed: { label: "Bidding closed", tone: "warning" },
  awarded: { label: "Awarded", tone: "success" },
};

export const OT_OFFER_STATUS: StatusMap = {
  open: { label: "Open", tone: "primary" },
  closed: { label: "Closed", tone: "warning" },
  awarded: { label: "Awarded", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const PAY_PERIOD_STATUS: StatusMap = {
  open: { label: "Open", tone: "primary" },
  locked: { label: "Locked", tone: "success" },
};

export const OFF_DAY_RESPONSE: StatusMap = {
  pending: { label: "Waiting", tone: "neutral" },
  accepted: { label: "Accepted", tone: "success" },
  declined: { label: "Declined", tone: "danger" },
  partial: { label: "Partly available", tone: "warning" },
};

export function StatusPill({ map, status }: { map: StatusMap; status: string }) {
  const s = map[status] ?? { label: status, tone: "neutral" as Tone };
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}
