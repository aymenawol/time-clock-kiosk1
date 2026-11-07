"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

export function ThemeProvider({ children, forcedTheme }: { children: React.ReactNode; forcedTheme?: string }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange forcedTheme={forcedTheme}>
      {children}
    </NextThemes>
  );
}

const subscribe = () => () => {};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const options = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "System" },
  ];
  return (
    <div className={cn("inline-flex rounded-[var(--radius-control)] bg-surface-2 p-0.5", className)} role="radiogroup" aria-label="Theme">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mounted && theme === value}
          aria-label={label}
          onClick={() => setTheme(value)}
          className={cn(
            "rounded p-1.5 text-muted transition-colors",
            mounted && theme === value && "bg-surface text-fg shadow-sm",
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
