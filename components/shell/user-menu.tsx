"use client";

import { Building2, ChevronDown, Inbox, LogOut } from "lucide-react";
import Link from "next/link";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Avatar } from "@/components/ui/misc";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import type { AppRole } from "@/lib/supabase/types";
import { signOut, switchOrganization } from "./actions";
import { ThemeToggle } from "./theme";

export interface ShellUser {
  employeeId: string;
  name: string;
  role: AppRole;
  organizationId: string;
  organizationName: string;
  organizations: { id: string; name: string; role: AppRole }[];
}

export function UserMenu({ user, compact }: { user: ShellUser; compact?: boolean }) {
  return (
    <Menu>
      <MenuTrigger className="flex items-center gap-2 rounded-[var(--radius-control)] p-1 pr-2 text-left hover:bg-surface-2" aria-label="Account menu">
        <Avatar name={user.name} />
        {compact ? null : (
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-sm font-medium leading-tight">{user.name}</span>
            <span className="block truncate text-xs leading-tight text-muted">{ROLE_LABEL[user.role]}</span>
          </span>
        )}
        <ChevronDown className="size-4 text-muted" aria-hidden />
      </MenuTrigger>
      <MenuContent className="w-64">
        <MenuLabel>
          <span className="block font-medium text-fg">{user.name}</span>
          {ROLE_LABEL[user.role]} · {user.organizationName}
        </MenuLabel>
        <MenuSeparator />
        <MenuItem asChild>
          <Link href="/m/requests">
            <Inbox /> My requests
          </Link>
        </MenuItem>
        {user.organizations.length > 1 ? (
          <>
            <MenuSeparator />
            <MenuLabel>Switch organization</MenuLabel>
            {user.organizations.map((o) => (
              <MenuItem key={o.id} disabled={o.id === user.organizationId} onSelect={() => void switchOrganization(o.id)}>
                <Building2 /> {o.name}
              </MenuItem>
            ))}
          </>
        ) : null}
        <MenuSeparator />
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs text-muted">Theme</span>
          <ThemeToggle />
        </div>
        <MenuSeparator />
        <MenuItem onSelect={() => void signOut()}>
          <LogOut /> Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
