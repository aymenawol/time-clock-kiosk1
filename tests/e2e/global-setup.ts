import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { PAIRING_CODE } from "./helpers";

function loadEnv() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* CI provides env vars */
  }
}

/** Re-seed the demo organization and create a known kiosk pairing code. */
export default async function globalSetup() {
  loadEnv();
  execSync("npx tsx scripts/seed.ts", { stdio: "inherit", env: process.env });
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, {
    auth: { persistSession: false },
  });
  const { data: org } = await db.from("organizations").select("id").eq("slug", "demo").single();
  const { error } = await db.from("kiosk_pairing_codes").insert({
    organization_id: org!.id,
    code_hash: createHash("sha256").update(PAIRING_CODE).digest("hex"),
    device_name: "E2E kiosk",
    expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
  });
  if (error) throw error;
}
