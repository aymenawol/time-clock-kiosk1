"use client";

import { Delete } from "lucide-react";
import { cn } from "@/lib/cn";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"] as const;

export function Keypad({ onKey, disabled }: { onKey: (key: string) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-3" role="group" aria-label="Keypad">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          disabled={disabled}
          onClick={() => onKey(k)}
          aria-label={k === "back" ? "Delete" : k === "clear" ? "Clear" : k}
          className={cn(
            "flex h-[72px] items-center justify-center rounded-[var(--radius-tile)] border border-border bg-surface text-3xl font-semibold tabular text-fg transition-colors active:scale-[0.98] active:bg-surface-3 disabled:opacity-50 sm:h-20",
            (k === "back" || k === "clear") && "bg-surface-2 text-base font-medium text-muted",
          )}
        >
          {k === "back" ? <Delete className="size-7" /> : k === "clear" ? "Clear" : k}
        </button>
      ))}
    </div>
  );
}
