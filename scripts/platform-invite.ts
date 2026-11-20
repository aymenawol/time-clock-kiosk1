/**
 * Send a Supabase invite to a platform operator so they can set a password.
 *
 *   npm run platform:invite -- you@example.com
 *
 * The email must also be listed in PLATFORM_ADMIN_EMAILS (server env) for
 * /platform to accept it. Prints no secrets.
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Usage: npm run platform:invite -- you@example.com");
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local");
    process.exit(1);
  }
  // The invite link must open the live app, not a local dev server.
  const site = (process.env.APP_URL || "https://rolecallmanager.vercel.app").replace(/\/$/, "");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { error } = await db.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${site}/auth/callback`,
    data: { must_change_password: true },
  });
  if (error) {
    console.error(`Invite failed: ${error.message}`);
    process.exit(1);
  }
  console.log(`Invite sent to ${email}. The link opens ${site}/auth/callback, then the set-password page.`);
  const listed = (process.env.PLATFORM_ADMIN_EMAILS ?? "").toLowerCase().split(",").map((e) => e.trim());
  if (!listed.includes(email)) console.log("Note: add this email to PLATFORM_ADMIN_EMAILS so /platform accepts it.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
