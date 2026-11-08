/**
 * Configure the hosted services for RoleCall. Idempotent; prints no secrets.
 *
 *   npm run setup:remote            # Supabase (Vault, function secrets, Auth) + Vercel env
 *   npm run setup:remote -- --dry   # show what would change
 *
 * Needs in .env.local: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF,
 * NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or _ANON_KEY),
 * SUPABASE_SECRET_KEY (or _SERVICE_ROLE_KEY), VERCEL_TOKEN, VERCEL_PROJECT_ID,
 * VERCEL_ORG_ID, NEXT_PUBLIC_SITE_URL. Optional: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
 * RESEND_API_KEY, RESEND_FROM (only set when the sending domain is verified).
 */
import { randomBytes } from "node:crypto";

const dry = process.argv.includes("--dry");
const env = (k: string, ...alts: string[]) => {
  for (const key of [k, ...alts]) if (process.env[key]) return process.env[key]!;
  return undefined;
};
const must = (k: string, ...alts: string[]) => {
  const v = env(k, ...alts);
  if (!v) throw new Error(`Missing ${k}`);
  return v;
};

const ref = must("SUPABASE_PROJECT_REF");
const sbToken = must("SUPABASE_ACCESS_TOKEN");
const siteUrl = must("NEXT_PUBLIC_SITE_URL").replace(/\/$/, "");

async function sb(path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${sbToken}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${init.method ?? "GET"} ${path}: ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const sql = (query: string) => sb("/database/query", { method: "POST", body: JSON.stringify({ query }) });
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

async function vaultSecret(name: string, value: string) {
  if (dry) return console.log(`[dry] vault secret ${name}`);
  await sql(
    `do $$ begin
       if exists (select 1 from vault.secrets where name = ${lit(name)}) then
         perform vault.update_secret((select id from vault.secrets where name = ${lit(name)}), ${lit(value)});
       else
         perform vault.create_secret(${lit(value)}, ${lit(name)});
       end if;
     end $$;`,
  );
  console.log(`vault secret ${name}: set`);
}

async function main() {
  // ---- Cron -> edge function shared secret ---------------------------------
  const existing = (await sql(`select decrypted_secret from vault.decrypted_secrets where name = 'rolecall_cron_secret'`)) as {
    decrypted_secret: string;
  }[];
  const cronSecret = existing[0]?.decrypted_secret ?? randomBytes(32).toString("base64url");
  await vaultSecret("rolecall_cron_secret", cronSecret);
  await vaultSecret("rolecall_functions_url", `https://${ref}.supabase.co/functions/v1`);

  const fnSecrets = [
    { name: "CRON_SECRET", value: cronSecret },
    { name: "APP_URL", value: siteUrl },
  ];
  if (env("RESEND_API_KEY")) fnSecrets.push({ name: "RESEND_API_KEY", value: env("RESEND_API_KEY")! });
  if (env("RESEND_FROM")) fnSecrets.push({ name: "RESEND_FROM", value: env("RESEND_FROM")! });
  if (dry) console.log(`[dry] function secrets: ${fnSecrets.map((s) => s.name).join(", ")}`);
  else {
    await sb("/secrets", { method: "POST", body: JSON.stringify(fnSecrets) });
    console.log(`function secrets: ${fnSecrets.map((s) => s.name).join(", ")}`);
  }
  if (!env("RESEND_FROM")) console.log("email: RESEND_FROM not set, so emails are recorded as 'skipped' (no verified sending domain).");

  // ---- Auth ----------------------------------------------------------------
  const auth = {
    site_url: siteUrl,
    uri_allow_list: [`${siteUrl}/**`, "http://localhost:3000/**", "https://*.vercel.app/**"].join(","),
    disable_signup: true,
    password_min_length: 10,
    security_update_password_require_reauthentication: false,
    mailer_otp_exp: 3600,
  };
  if (dry) console.log("[dry] auth config", auth);
  else {
    await sb("/config/auth", { method: "PATCH", body: JSON.stringify(auth) });
    console.log("auth: public sign-up disabled, site URL and redirect URLs set, min password 10");
  }

  // ---- Vercel environment ----------------------------------------------------
  const vToken = must("VERCEL_TOKEN");
  const project = must("VERCEL_PROJECT_ID");
  const team = must("VERCEL_ORG_ID");
  const vars: { key: string; value: string; type: "plain" | "encrypted" }[] = [
    { key: "NEXT_PUBLIC_SUPABASE_URL", value: must("NEXT_PUBLIC_SUPABASE_URL"), type: "plain" },
    { key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", value: must("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"), type: "plain" },
    { key: "NEXT_PUBLIC_SITE_URL", value: siteUrl, type: "plain" },
    { key: "SUPABASE_SECRET_KEY", value: must("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"), type: "encrypted" },
  ];
  if (env("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")) {
    vars.push({ key: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", value: env("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")!, type: "plain" });
  }
  for (const v of vars) {
    if (dry) {
      console.log(`[dry] vercel env ${v.key}`);
      continue;
    }
    const res = await fetch(`https://api.vercel.com/v10/projects/${project}/env?upsert=true&teamId=${team}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${vToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...v, target: ["production", "preview", "development"] }),
    });
    if (!res.ok) throw new Error(`Vercel env ${v.key}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    console.log(`vercel env ${v.key}: set`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
