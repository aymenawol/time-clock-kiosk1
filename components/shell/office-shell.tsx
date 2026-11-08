"use client";

import { Menu as MenuIcon, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { can } from "@/lib/auth/permissions";
import { cn } from "@/lib/cn";
import { OFFICE_NAV } from "@/lib/nav";
import { Wordmark, BrandMark } from "./brand";
import { EmergencyGate } from "./emergency-gate";
import { NotificationBell } from "./notification-bell";
import { UserMenu, type ShellUser } from "./user-menu";

function isActive(pathname: string, href: string) {
  if (href === "/fleet") return pathname === "/fleet" || /^\/fleet\/[0-9a-f-]{36}/.test(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Nav({ user, collapsed, onNavigate }: { user: ShellUser; collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-4 px-2 py-3">
      {OFFICE_NAV.map((group) => {
        const items = group.items.filter((i) => can(user.role, i.capability));
        if (!items.length) return null;
        return (
          <div key={group.label}>
            {collapsed ? (
              <div className="mx-3 mb-1 h-px bg-border" />
            ) : (
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{group.label}</p>
            )}
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-sm transition-colors",
                        active ? "bg-primary-soft font-medium text-primary" : "text-muted hover:bg-surface-2 hover:text-fg",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function OfficeShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface lg:flex",
          collapsed ? "w-16" : "w-62",
        )}
      >
        <div className={cn("flex h-14 items-center border-b border-border", collapsed ? "justify-center" : "justify-between px-4")}>
          {collapsed ? <BrandMark /> : <Wordmark />}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Nav user={user} collapsed={collapsed} />
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-10 items-center justify-center gap-2 border-t border-border text-xs text-muted hover:text-fg"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {collapsed ? null : "Collapse"}
        </button>
      </aside>

      {/* Mobile and tablet drawer */}
      {drawer ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setDrawer(false)} />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-surface shadow-[var(--shadow-pop)]">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <Wordmark />
              <button type="button" onClick={() => setDrawer(false)} className="rounded p-1 text-muted hover:bg-surface-2" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Nav user={user} onNavigate={() => setDrawer(false)} />
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur">
          <button
            type="button"
            className="-ml-1 rounded p-1.5 text-muted hover:bg-surface-2 lg:hidden"
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
          >
            <MenuIcon className="size-5" />
          </button>
          <div className="lg:hidden">
            <BrandMark />
          </div>
          <p className="min-w-0 truncate text-sm font-medium text-muted">{user.organizationName}</p>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell employeeId={user.employeeId} />
            <UserMenu user={user} />
          </div>
        </header>
        <main id="main" className="mx-auto w-full min-w-0 max-w-[1440px] flex-1 px-4 py-5 sm:px-6">
          {children}
        </main>
      </div>
      <EmergencyGate organizationId={user.organizationId} employeeId={user.employeeId} />
    </div>
  );
}
