import type { Metadata } from "next";
import { BackHeader } from "@/components/requests/back-header";
import { LostFoundForm } from "@/components/requests/lost-found-form";
import { Badge } from "@/components/ui/badge";
import { SectionTitle } from "@/components/ui/misc";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Report lost item" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "neutral" | "primary" | "success" | "warning" }> = {
  found: { label: "Reported", tone: "primary" },
  collected: { label: "Collected", tone: "primary" },
  at_dispatch: { label: "At dispatch", tone: "warning" },
  claimed: { label: "Claimed", tone: "success" },
  disposed: { label: "Closed", tone: "neutral" },
};

export default async function LostFoundPage() {
  const auth = await requireAuth("field");
  const [locRes, vehRes, itemsRes] = await Promise.all([
    auth.supabase.from("locations").select("id, name").eq("organization_id", auth.org.id).eq("active", true).order("sort").order("name"),
    auth.supabase.from("vehicles").select("id, number").eq("organization_id", auth.org.id).eq("active", true).order("number"),
    auth.supabase
      .from("lost_items")
      .select("id, reference, description, status, found_at")
      .eq("organization_id", auth.org.id)
      .eq("found_by", auth.employee.id)
      .order("found_at", { ascending: false })
      .limit(20),
  ]);
  const items = itemsRes.data ?? [];

  return (
    <>
      <BackHeader href="/m/requests" backLabel="Requests" title="Report lost item" description="Found something left behind? Log it here." />
      <LostFoundForm organizationId={auth.org.id} locations={locRes.data ?? []} vehicles={vehRes.data ?? []} />

      <section aria-label="Items I reported" className="mt-10">
        <SectionTitle>Items I reported</SectionTitle>
        {itemsRes.error ? (
          <p role="alert" className="text-sm text-danger">
            Could not load your items.
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">Nothing reported yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((i) => {
              const s = STATUS[i.status] ?? { label: i.status, tone: "neutral" as const };
              return (
                <li key={i.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{i.description}</span>
                    <span className="block text-sm text-muted">
                      <span className="tabular font-semibold">{i.reference}</span> · {fmtDateTime(i.found_at, auth.org.timezone, auth.settings.clock24h)}
                    </span>
                  </span>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
