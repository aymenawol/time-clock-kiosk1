import { CalendarRange, ChevronRight, Clock3, FileText, PackageSearch, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { nowMs } from "@/components/requests/data";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Requests" };
export const dynamic = "force-dynamic";

export default async function RequestsHubPage() {
  const auth = await requireAuth("field");
  const now = nowMs();
  const nowIso = new Date(now).toISOString();
  const me = auth.employee.id;
  const org = auth.org.id;
  const role = auth.employee.role;

  const [forms, ack, bids, offers, meetings, offDays] = await Promise.all([
    auth.supabase.from("form_submissions").select("id", { count: "exact", head: true }).eq("organization_id", org).eq("employee_id", me).in("status", ["submitted", "returned"]),
    auth.supabase.from("form_submissions").select("id", { count: "exact", head: true }).eq("organization_id", org).eq("employee_id", me).in("status", ["approved", "denied"]).is("acknowledged_at", null),
    auth.supabase.from("bid_cycles").select("id").eq("organization_id", org).eq("status", "open").lte("opens_at", nowIso).gte("closes_at", nowIso),
    auth.supabase.from("ot_offers").select("id, eligible_roles").eq("organization_id", org).eq("status", "open").gt("bid_closes_at", nowIso),
    auth.supabase
      .from("safety_meetings")
      .select("id, audience, starts_at, duration_minutes")
      .eq("organization_id", org)
      .eq("status", "scheduled")
      .gte("starts_at", new Date(now - 6 * 3600_000).toISOString())
      .limit(50),
    auth.supabase.from("off_day_requests").select("id", { count: "exact", head: true }).eq("organization_id", org).eq("employee_id", me).eq("response", "pending"),
  ]);

  const openOffers = (offers.data ?? []).filter((o) => o.eligible_roles.length === 0 || o.eligible_roles.includes(role)).length;
  const upcoming = (meetings.data ?? []).filter(
    (m) => (m.audience.length === 0 || m.audience.includes(role)) && new Date(m.starts_at).getTime() + m.duration_minutes * 60_000 >= now,
  ).length;
  const openBids = bids.data?.length ?? 0;
  const pendingForms = forms.count ?? 0;
  const decisions = ack.count ?? 0;
  const pendingOffDays = offDays.count ?? 0;

  const cards = [
    {
      href: "/m/forms",
      icon: FileText,
      title: "Forms",
      text: "Time off, incident reports and other requests.",
      badge: decisions > 0 ? { tone: "primary" as const, label: `${decisions} new ${decisions === 1 ? "decision" : "decisions"}` } : pendingForms > 0 ? { tone: "neutral" as const, label: `${pendingForms} pending` } : null,
    },
    {
      href: "/m/bids",
      icon: CalendarRange,
      title: "Shift bids",
      text: "Rank the lines you want.",
      badge: openBids > 0 ? { tone: "success" as const, label: "Bidding open" } : null,
    },
    {
      href: "/m/overtime",
      icon: Clock3,
      title: "Overtime",
      text: "Extra shifts and day-off requests.",
      badge:
        pendingOffDays > 0
          ? { tone: "warning" as const, label: `${pendingOffDays} to answer` }
          : openOffers > 0
            ? { tone: "success" as const, label: `${openOffers} open` }
            : null,
    },
    {
      href: "/m/safety",
      icon: ShieldCheck,
      title: "Safety meetings",
      text: "See the schedule and sign in.",
      badge: upcoming > 0 ? { tone: "primary" as const, label: `${upcoming} upcoming` } : null,
    },
    {
      href: "/m/lost-found",
      icon: PackageSearch,
      title: "Report lost item",
      text: "Log something left on a bus or at a stop.",
      badge: null,
    },
  ];

  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Requests</h1>
      <p className="mb-5 text-sm text-muted">Everything you can ask for or sign up for.</p>
      <ul className="flex flex-col gap-3">
        {cards.map((c) => (
          <li key={c.href}>
            <Link
              href={c.href}
              className="flex min-h-20 items-center gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 hover:bg-surface-2"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <c.icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{c.title}</span>
                  {c.badge ? <Badge tone={c.badge.tone}>{c.badge.label}</Badge> : null}
                </span>
                <span className="block text-sm text-muted">{c.text}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
