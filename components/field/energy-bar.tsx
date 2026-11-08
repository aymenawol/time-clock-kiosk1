import { cn } from "@/lib/cn";

/** Fuel or battery level as a labelled bar. */
export function EnergyBar({
  level,
  noun,
  low,
  className,
}: {
  level: number | null;
  noun: string;
  low: number;
  className?: string;
}) {
  if (level === null) return <p className={cn("text-xs text-muted", className)}>{noun} level unknown</p>;
  const tone = level < low / 2 ? "bg-danger" : level < low ? "bg-warning" : "bg-success";
  const text = level < low / 2 ? "text-danger" : level < low ? "text-warning" : "text-muted";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="w-14 shrink-0 text-xs text-muted">{noun}</span>
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"
        role="meter"
        aria-label={`${noun} level`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={level}
      >
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max(2, level)}%` }} />
      </div>
      <span className={cn("w-10 shrink-0 text-right text-xs font-medium tabular", text)}>{level}%</span>
    </div>
  );
}
