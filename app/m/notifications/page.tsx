import { Bell } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BackHeader, LoadError } from "@/components/requests/back-header";
import { MarkAllReadButton, NotificationList } from "@/components/requests/notification-list";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { LiveRefresh } from "@/components/realtime/use-live-refresh";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Math.min(200, Number.parseInt(sp.page ?? "1", 10) || 1));
  const auth = await requireAuth("field");
  const from = (page - 1) * PAGE_SIZE;

  const { data, error, count } = await auth.supabase
    .from("notifications")
    .select("id, title, body, link, severity, read_at, created_at", { count: "exact" })
    .eq("organization_id", auth.org.id)
    .eq("employee_id", auth.employee.id)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const items = (data ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    link: n.link,
    severity: n.severity,
    unread: n.read_at === null,
    when: fmtDateTime(n.created_at, auth.org.timezone, auth.settings.clock24h),
  }));
  const total = count ?? items.length;
  const hasNext = from + PAGE_SIZE < total;

  return (
    <>
      <LiveRefresh organizationId={auth.org.id} tables={["notifications"]} />
      <BackHeader
        href="/m/me"
        backLabel="Me"
        title="Notifications"
        actions={<MarkAllReadButton disabled={!items.some((i) => i.unread)} />}
      />
      {error ? (
        <LoadError what="notifications" />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState icon={Bell} title="You are all caught up" description="Alerts about your requests, bids and shifts show here." />
        </Card>
      ) : (
        <>
          <NotificationList items={items} />
          {page > 1 || hasNext ? (
            <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Pages">
              {page > 1 ? (
                <Button asChild variant="secondary" size="lg">
                  <Link href={`/m/notifications?page=${page - 1}`}>Newer</Link>
                </Button>
              ) : (
                <span />
              )}
              <span className="text-sm text-muted">Page {page}</span>
              {hasNext ? (
                <Button asChild variant="secondary" size="lg">
                  <Link href={`/m/notifications?page=${page + 1}`}>Older</Link>
                </Button>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
