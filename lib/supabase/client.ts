"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Browser Supabase client (singleton). Used for Realtime and storage uploads. */
export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
  }
  return browserClient;
}
