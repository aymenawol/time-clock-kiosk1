import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { Age } from "@/components/ops/timers";
import { serverNow } from "@/components/ops/time";
import { LiveRefresh } from "@/components/realtime/use-live-refresh";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { can, ROLE_LABEL, ROLES } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime, fullName } from "@/lib/format";
import { KIND_LABEL } from "./_components/labels";
import { ResolveButton } from "./_components/resolve-button";
import { TriggerForm } from "./_components/trigger-form";

export const metadata: Metadata = { title: "Emergency" };

const kindLabel = (k: string) => (k in KIND_LABEL ? KIND_LABEL[k as keyof typeof KIND_LABEL] : k);

export default async function EmergencyPage() {
  const auth = await requireAuth("emergencyView");
  const { supabase, org } = auth;
  const tz = org.timezone;
  const c24 = auth.settings.clock24h;
  const canTrigger = can(auth.employee.role, "emergencyTrigger");

  const [activeRes, historyRes, peopleRes] = await Promise.all([
    supabase.from("emergencies").select("*").eq("organization_id", org.id).eq("active", true).maybeSingle(),
    supabase
      .from("emergencies")
      .select("*")
      .eq("organization_id", org.id)
      .eq("active", false)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("employees")
      .select("id, first_name, last_name, role")
      .eq("organization_id", org.id)
      .eq("status", "active"),
  ]);
  if (activeRes.error) throw activeRes.error;
  const active = activeRes.data;
  const history = historyRes.data ?? [];
  const people = peopleRes.data ?? [];
  const nameOf = new Map(people.map((p) => [p.id, fullName(p)]));

  const ids = [...(active ? [active.id] : []), ...history.map((h) => h.id)];
  const acksRes = ids.length
    ? await supabase.from("emergency_acks").select("emergency_id, employee_id, acked_at").eq("organization_id", org.id).in("emergency_id", ids)
    : { data: [] };
  const acks = acksRes.data ?? [];
  const ackedFor = (id: string) => new Set(acks.filter((a) => a.emergency_id === id).map((a) => a.employee_id));

  const now = serverNow();
  let progress: { role: string; acked: number; total: number; waiting: string[] }[] = [];
  let ackedCount = 0;
  if (active) {
    const acked = ackedFor(active.id);
    ackedCount = people.filter((p) => acked.has(p.id)).length;
    progress = ROLES.map((role) => {
      const group = people.filter((p) => p.role === role);
      return {
        role,
        acked: group.filter((p) => acked.has(p.id)).length,
        total: group.length,
        waiting: group.filter((p) => !acked.has(p.id)).map(fullName),
      };
    }).filter((g) => g.total > 0);
  }

  return (
    <>
      <LiveRefresh organizationId={org.id} tables={["emergencies", "emergency_acks"]} debounceMs={500} />
      <PageHeader title="Emergency" description="Alert the whole team and track who has acknowledged." />

      <div className="flex flex-col gap-4">
        {active ? (
          <section
            className="rounded-[var(--radius-card)] border-2 border-danger bg-danger-soft p-4 sm:p-6"
            aria-label="Active emergency"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <span className="size-3 shrink-0 animate-pulse rounded-full bg-danger" aria-hidden />
                <h2 className="text-lg font-bold uppercase tracking-wide text-danger">
                  Emergency active: {kindLabel(active.kind)}
                </h2>
              </div>
              <p className="tabular text-xs text-muted">
                {fmtDateTime(active.created_at, tz, c24)} · <Age at={active.created_at} serverNow={now} suffix=" ago" />
              </p>
            </div>
            <p className="font-semibold">{active.title}</p>
            <p className="mb-5 mt-1 whitespace-pre-wrap">{active.message}</p>
            {active.triggered_by ? (
              <p className="-mt-3 mb-5 text-xs text-muted">Triggered by {nameOf.get(active.triggered_by) ?? "a manager"}</p>
            ) : null}

            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[var(--radius-card)] border border-success/40 bg-success-soft p-4">
                <p className="tabular text-2xl font-bold text-success">{ackedCount}</p>
                <p className="text-sm text-success">Acknowledged</p>
              </div>
              <div className="rounded-[var(--radius-card)] border border-warning/40 bg-warning-soft p-4">
                <p className="tabular text-2xl font-bold text-warning">{people.length - ackedCount}</p>
                <p className="text-sm text-warning">Not yet acknowledged</p>
              </div>
            </div>

            <ul className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Acknowledgement progress by role">
              {progress.map((g) => (
                <li key={g.role} className="rounded-[var(--radius-control)] border border-border bg-surface p-3">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{ROLE_LABEL[g.role as keyof typeof ROLE_LABEL]}</span>
                    <span className="tabular text-muted">
                      {g.acked} of {g.total}
                    </span>
                  </div>
                  <div
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={g.total}
                    aria-valuenow={g.acked}
                    aria-label={`${ROLE_LABEL[g.role as keyof typeof ROLE_LABEL]} acknowledged`}
                  >
                    <div className="h-full bg-success" style={{ width: `${(g.acked / g.total) * 100}%` }} />
                  </div>
                  {g.waiting.length ? (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-warning">Waiting on {g.waiting.length}</summary>
                      <p className="mt-1 text-muted">{g.waiting.join(", ")}</p>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>

            {canTrigger ? <ResolveButton id={active.id} unacknowledged={people.length - ackedCount} /> : null}
          </section>
        ) : canTrigger ? (
          <TriggerForm audience={people.length} />
        ) : (
          <Card>
            <EmptyState icon={ShieldCheck} title="No active emergency" description="If one is triggered you will see it here and get a full-screen alert." />
          </Card>
        )}

        <Card>
          <CardHeader title="History" description="The last 20 resolved emergencies." />
          {history.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No past emergencies.</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {h.title}
                      <Badge tone="neutral">{kindLabel(h.kind)}</Badge>
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-muted">{h.message}</p>
                  </div>
                  <div className="tabular shrink-0 text-xs text-muted sm:text-right">
                    <p>
                      {fmtDateTime(h.created_at, tz, c24)} to {fmtDateTime(h.resolved_at, tz, c24)}
                    </p>
                    <p>
                      {ackedFor(h.id).size} acknowledged
                      {h.resolved_by ? ` · resolved by ${nameOf.get(h.resolved_by) ?? "a manager"}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
