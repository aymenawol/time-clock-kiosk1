import { cn } from "@/lib/cn";

/** Fuel or charge level as a small bar with a number. */
export function Energy({ value, low }: { value: number | null | undefined; low?: boolean }) {
  if (value === null || value === undefined) return <span className="text-muted">-</span>;
  return (
    <span className="inline-flex items-center gap-2 tabular">
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <span
          className={cn("block h-full rounded-full", low ? "bg-danger" : value < 50 ? "bg-warning" : "bg-success")}
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </span>
      {value}%
    </span>
  );
}

export const POWERTRAIN_LABEL: Record<string, string> = {
  diesel: "Diesel",
  gasoline: "Gasoline",
  cng: "CNG",
  hybrid: "Hybrid",
  ev: "Electric",
};

export const SEVERITY_LABEL: Record<string, string> = { minor: "Minor", major: "Major", critical: "Critical" };
export const DEFECT_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  deferred: "Deferred",
  resolved: "Resolved",
};
