import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";
import type { Database } from "./database.types";

/**
 * Service-role client. Bypasses RLS, so use it only where there is no user
 * session (kiosk punches) or for Auth admin operations, and only after the
 * caller has been authorized in code.
 */
export function createAdminClient() {
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
