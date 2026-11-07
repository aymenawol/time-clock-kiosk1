"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Re-render the current server page whenever one of `tables` changes for the
 * organization. Server Components stay the single source of truth; Realtime
 * only says "something changed". Changes are coalesced (default 750 ms).
 * RLS applies to Realtime, so users only hear about rows they can read.
 */
export function useLiveRefresh(organizationId: string, tables: string[], debounceMs = 750) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = tables.join(",");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`live:${organizationId}:${key}:${Math.random().toString(36).slice(2)}`);
    for (const table of key.split(",")) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `organization_id=eq.${organizationId}` },
        () => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => router.refresh(), debounceMs);
        },
      );
    }
    channel.subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [organizationId, key, debounceMs, router]);
}

/** Component form of useLiveRefresh, for use inside Server Component pages. */
export function LiveRefresh({ organizationId, tables, debounceMs }: { organizationId: string; tables: string[]; debounceMs?: number }) {
  useLiveRefresh(organizationId, tables, debounceMs);
  return null;
}
