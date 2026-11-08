import { notFound } from "next/navigation";
import { audienceLabel } from "@/components/people/labels";
import { fmtDate, fmtTime } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Safety meeting schedule",
  robots: { index: false, follow: false },
};

/**
 * Public, read-only schedule of upcoming safety meetings. Reached by an
 * unguessable per-organization token; shows no employee data.
 */
export default async function PublicSchedulePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{16,128}$/i.test(token)) notFound();

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("id, name, timezone, settings, public_token")
    .eq("public_token", token)
    .maybeSingle();
  if (!org || org.public_token !== token) notFound();

  const now = new Date();
  const until = new Date(now.getTime() + 60 * 86400_000);
  const { data: meetings } = await admin
    .from("safety_meetings")
    .select("id, title, audience, starts_at, duration_minutes, location, notes")
    .eq("organization_id", org.id)
    .eq("status", "scheduled")
    .gte("starts_at", new Date(now.getTime() - 2 * 3600_000).toISOString())
    .lte("starts_at", until.toISOString())
    .order("starts_at")
    .limit(200);

  const settings = (org.settings ?? {}) as { clock24h?: boolean };
  const c24 = settings.clock24h === true;
  const upcoming = (meetings ?? []).filter((m) => new Date(m.starts_at).getTime() + m.duration_minutes * 60000 >= now.getTime());
  const day = (iso: string) => fmtDate(iso, org.timezone, "EEEE, MMMM d");

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-4 py-8 sm:py-12 print:max-w-none print:py-0">
      <header className="mb-6 border-b border-border pb-4">
        <p className="text-sm font-medium text-muted">{org.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Safety meeting schedule</h1>
        <p className="mt-1 text-sm text-muted">Meetings in the next 60 days. Times are {org.timezone.replace(/_/g, " ")}.</p>
      </header>

      {upcoming.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-border bg-surface p-6 text-center text-muted">
          No safety meetings are scheduled in the next 60 days.
        </p>
      ) : (
        <ol className="grid gap-3">
          {upcoming.map((m, i) => {
            const newDay = i === 0 || day(upcoming[i - 1].starts_at) !== day(m.starts_at);
            return (
              <li key={m.id} className="break-inside-avoid">
                {newDay ? <h2 className="mb-2 mt-3 text-sm font-semibold uppercase tracking-wide text-muted">{day(m.starts_at)}</h2> : null}
                <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base font-semibold">{m.title}</h3>
                    <p className="tabular text-sm font-medium">
                      {fmtTime(m.starts_at, org.timezone, c24)} to{" "}
                      {fmtTime(new Date(new Date(m.starts_at).getTime() + m.duration_minutes * 60000), org.timezone, c24)}
                    </p>
                  </div>
                  <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    <div className="flex gap-2">
                      <dt className="text-muted">Where</dt>
                      <dd>{m.location ?? "To be announced"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-muted">Who</dt>
                      <dd>{audienceLabel(m.audience)}</dd>
                    </div>
                  </dl>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-8 text-xs text-muted print:hidden">Use your browser&apos;s print option to print this page.</p>
    </main>
  );
}
