"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { signOut } from "@/components/shell/actions";
import { ThemeToggle } from "@/components/shell/theme";
import { Button } from "@/components/ui/button";

export function ThemeRow() {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium">Theme</span>
      <ThemeToggle />
    </div>
  );
}

export function SignOutButton() {
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" size="xl" className="w-full" loading={pending} onClick={() => start(() => signOut())}>
      <LogOut aria-hidden /> Sign out
    </Button>
  );
}
