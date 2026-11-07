"use client";

import { Tabs as T } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/cn";

export const Tabs = T.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return (
    <T.List
      className={cn("inline-flex max-w-full gap-1 overflow-x-auto rounded-[var(--radius-control)] bg-surface-2 p-1", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium text-muted transition-colors data-[state=active]:bg-surface data-[state=active]:text-fg data-[state=active]:shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = T.Content;
