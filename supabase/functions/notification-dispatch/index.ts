// Sends pending notification emails through Resend.
//
// Called every minute by pg_cron (private.dispatch_email) with the header
// `x-cron-secret`, which must match the CRON_SECRET function secret. Rows are
// claimed atomically (public.claim_email_notifications), so overlapping runs
// never double-send. When Resend is not configured (no API key or no verified
// sender), rows are marked 'skipped' with the reason, never 'sent'.
//
// Secrets: CRON_SECRET, RESEND_API_KEY, RESEND_FROM (e.g. "RoleCall <alerts@example.com>"),
// APP_URL (e.g. https://rolecallmanager.vercel.app). SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

interface Claimed {
  id: string;
  email: string | null;
  first_name: string;
  organization_name: string;
  title: string;
  body: string | null;
  link: string | null;
  severity: string;
  attempts: number;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function render(n: Claimed, appUrl: string | undefined) {
  const accent = n.severity === "critical" ? "#C62828" : n.severity === "warning" ? "#B26A00" : "#095FFC";
  const link = n.link && appUrl ? `${appUrl.replace(/\/$/, "")}${n.link}` : null;
  const html = `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0e1726">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border:1px solid #dce1e8;border-radius:10px">
<tr><td style="padding:20px 24px;border-bottom:3px solid ${accent}">
<p style="margin:0;font-size:12px;color:#5b6676">${escapeHtml(n.organization_name)} · RoleCall</p>
<h1 style="margin:6px 0 0;font-size:18px">${escapeHtml(n.title)}</h1></td></tr>
<tr><td style="padding:20px 24px;font-size:15px;line-height:1.5">
<p style="margin:0 0 12px">Hi ${escapeHtml(n.first_name)},</p>
${n.body ? `<p style="margin:0 0 12px;white-space:pre-wrap">${escapeHtml(n.body)}</p>` : ""}
${link ? `<p style="margin:16px 0 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#095FFC;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600">Open in RoleCall</a></p>` : ""}
</td></tr></table>
<p style="font-size:12px;color:#5b6676">You get this email because you work with ${escapeHtml(n.organization_name)} on RoleCall.</p>
</td></tr></table></body></html>`;
  const text = `${n.title}\n\n${n.body ?? ""}${link ? `\n\nOpen in RoleCall: ${link}` : ""}`;
  return { html, text };
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  const given = req.headers.get("x-cron-secret") ?? "";
  if (!secret || !safeEqual(given, secret)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("claim_email_notifications", { p_limit: 50 });
  if (error) {
    console.error("claim failed", error);
    return new Response(JSON.stringify({ error: "claim_failed" }), { status: 500 });
  }
  const batch = (data ?? []) as Claimed[];
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM");
  const appUrl = Deno.env.get("APP_URL");
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const n of batch) {
    if (!apiKey || !from) {
      skipped++;
      await supabase.rpc("complete_email_notification", { p_id: n.id, p_status: "skipped", p_error: "Email sender not configured" });
      continue;
    }
    if (!n.email) {
      skipped++;
      await supabase.rpc("complete_email_notification", { p_id: n.id, p_status: "skipped", p_error: "No email address" });
      continue;
    }
    const { html, text } = render(n, appUrl);
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": n.id },
        body: JSON.stringify({ from, to: [n.email], subject: n.title, html, text }),
      });
      if (res.ok) {
        sent++;
        await supabase.rpc("complete_email_notification", { p_id: n.id, p_status: "sent" });
      } else {
        failed++;
        const detail = await res.text();
        await supabase.rpc("complete_email_notification", { p_id: n.id, p_status: "failed", p_error: `Resend ${res.status}: ${detail}` });
      }
    } catch (err) {
      failed++;
      await supabase.rpc("complete_email_notification", { p_id: n.id, p_status: "failed", p_error: String(err) });
    }
  }

  return new Response(JSON.stringify({ claimed: batch.length, sent, skipped, failed }), {
    headers: { "Content-Type": "application/json" },
  });
});
