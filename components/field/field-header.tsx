import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/** Title row for field task pages, with a back link to the home screen. */
export function FieldHeader({
  title,
  description,
  back = "/m",
  backLabel = "Home",
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: string | null;
  backLabel?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4", className)}>
      {back ? (
        <Link
          href={back}
          className="-ml-2 mb-1 inline-flex h-10 items-center gap-1 rounded-[var(--radius-control)] px-2 text-sm font-medium text-muted hover:text-fg"
        >
          <ChevronLeft className="size-4" aria-hidden /> {backLabel}
        </Link>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

/** Inline notice box for field pages. */
export function Notice({
  tone = "info",
  icon: Icon,
  title,
  children,
  className,
  role,
}: {
  tone?: "info" | "warning" | "danger" | "success" | "neutral";
  icon?: React.ComponentType<{ className?: string }>;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  const tones = {
    info: "border-info/30 bg-info-soft text-info",
    warning: "border-warning/30 bg-warning-soft text-warning",
    danger: "border-danger/30 bg-danger-soft text-danger",
    success: "border-success/30 bg-success-soft text-success",
    neutral: "border-border bg-surface-2 text-muted",
  }[tone];
  return (
    <div role={role} className={cn("flex gap-3 rounded-[var(--radius-card)] border px-4 py-3", tones, className)}>
      {Icon ? <Icon className="mt-0.5 size-5 shrink-0" aria-hidden /> : null}
      <div className="min-w-0 text-sm">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title ? "mt-0.5" : undefined, "text-fg/90")}>{children}</div> : null}
      </div>
    </div>
  );
}
