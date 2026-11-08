"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { FIELD_TABS } from "@/lib/nav";
import { BrandMark } from "./brand";
import { EmergencyGate } from "./emergency-gate";
import { NotificationBell } from "./notification-bell";
import { UserMenu, type ShellUser } from "./user-menu";

export function FieldShell({
  user,
  children,
  extra,
}: {
  user: ShellUser;
  children: React.ReactNode;
  /** Mounted once for the whole field app (e.g. the GPS reporter). */
  extra?: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-surface/95 px-4 backdrop-blur">
        <BrandMark className="size-6" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{user.organizationName}</p>
        <NotificationBell employeeId={user.employeeId} />
        <UserMenu user={user} compact />
      </header>
      <main id="main" className="mx-auto w-full min-w-0 max-w-xl flex-1 px-4 pb-28 pt-4">
        {children}
      </main>
      <nav
        aria-label="Field app"
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-4">
          {FIELD_TABS.map((tab) => {
            const active = tab.href === "/m" ? pathname === "/m" : pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium",
                    active ? "text-primary" : "text-muted hover:text-fg",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {extra}
      <EmergencyGate organizationId={user.organizationId} employeeId={user.employeeId} />
    </div>
  );
}
