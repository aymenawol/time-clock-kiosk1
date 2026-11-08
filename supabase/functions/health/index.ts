// Health probe for uptime monitoring: confirms the function runtime can reach
// the database. Public (no data returned), so verify_jwt is off.
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async () => {
  const started = Date.now();
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.from("organizations").select("id", { head: true, count: "exact" }).limit(1);
  const body = { status: error ? "degraded" : "ok", db: error ? "error" : "ok", ms: Date.now() - started };
  return new Response(JSON.stringify(body), {
    status: error ? 503 : 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});
