"use client";

import { cn } from "@/lib/cn";

export interface ChoiceOption<T extends string> {
  value: T;
  label: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "danger" | "warning" | "success";
}

/**
 * Large radio-style buttons for phones (48 px or taller). Renders a real
 * radiogroup so it works with a keyboard and screen readers.
 */
export function Choice<T extends string>({
  value,
  onChange,
  options,
  label,
  columns = 2,
  disabled,
  className,
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: ChoiceOption<T>[];
  label: string;
  columns?: 1 | 2 | 3 | 4;
  disabled?: boolean;
  className?: string;
}) {
  const cols = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }[columns];
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-2", cols, className)}>
      {options.map((o) => {
        const selected = o.value === value;
        const Icon = o.icon;
        const tone = o.tone ?? "default";
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex min-h-12 items-center gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-left text-sm font-medium transition-colors disabled:opacity-50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              !selected && "border-border bg-surface text-fg hover:bg-surface-2",
              selected && tone === "default" && "border-primary bg-primary-soft text-primary",
              selected && tone === "danger" && "border-danger bg-danger-soft text-danger",
              selected && tone === "warning" && "border-warning bg-warning-soft text-warning",
              selected && tone === "success" && "border-success bg-success-soft text-success",
            )}
          >
            {Icon ? <Icon className="size-5 shrink-0" /> : null}
            <span className="min-w-0">
              <span className="block">{o.label}</span>
              {o.hint ? <span className="block text-xs font-normal text-muted">{o.hint}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
