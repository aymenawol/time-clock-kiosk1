import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Liveness plus a database round trip. Returns no data. */
export async function GET() {
  const started = Date.now();
  const { error } = await createAdminClient().from("organizations").select("id", { head: true, count: "exact" }).limit(1);
  return NextResponse.json(
    { status: error ? "degraded" : "ok", db: error ? "error" : "ok", ms: Date.now() - started },
    { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
