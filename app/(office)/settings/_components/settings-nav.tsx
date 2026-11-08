"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const GROUPS: { title: string; items: { href: string; label: string }[] }[] = [
  {
    title: "Organization",
    items: [
      { href: "/settings", label: "General" },
      { href: "/settings/labor", label: "Labor rules" },
      { href: "/settings/breaks", label: "Breaks" },
      { href: "/settings/fatigue", label: "Fatigue" },
      { href: "/settings/assist", label: "Assist" },
      { href: "/settings/notifications", label: "Notifications" },
      { href: "/settings/gps", label: "GPS" },
      { href: "/settings/readiness", label: "Readiness" },
    ],
  },
  {
    title: "Devices",
    items: [
      { href: "/settings/kiosks", label: "Kiosks" },
      { href: "/settings/kiosk", label: "Kiosk options" },
      { href: "/settings/tablets", label: "Tablets" },
    ],
  },
  {
    title: "Catalogues",
    items: [
      { href: "/settings/locations", label: "Locations" },
      { href: "/settings/airlines", label: "Airlines" },
      { href: "/settings/routes", label: "Routes" },
      { href: "/settings/radio-codes", label: "Radio codes" },
      { href: "/settings/checklist", label: "Inspection checklist" },
    ],
  },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings" className="flex gap-4 overflow-x-auto pb-1 lg:flex-col lg:gap-5 lg:overflow-visible lg:pb-0">
      {GROUPS.map((g) => (
        <div key={g.title} className="flex shrink-0 items-center gap-1 lg:flex-col lg:items-stretch">
          <p className="hidden px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted lg:block">{g.title}</p>
          {g.items.map((i) => {
            const active = pathname === i.href;
            return (
              <Link
                key={i.href}
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-[var(--radius-control)] px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                {i.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
