import { notFound } from "next/navigation";
import { fmtDate, fmtTime } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Safety meeting schedules",
  robots: { index: false, follow: false },
};

// Poster sections in the v0 order, with the roles each one covers.
const SECTIONS: { label: string; roles: AppRole[] }[] = [
  { label: "Driver", roles: ["driver"] },
  { label: "Coordinator", roles: ["coordinator"] },
  { label: "Fueler/Washer", roles: ["fueler"] },
  { label: "Technician", roles: ["technician"] },
];

const DEFAULT_INSTRUCTION = "Drivers and Coordinators - Please have vests and closed-toe shoes.";

/**
 * Public, read-only monthly safety meeting schedule laid out like the printed poster.
 * Reached by an unguessable per-organization token; shows no employee data.
 * `?month=YYYY-MM` picks another month.
 */
export default async function PublicSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  if (!/^[a-f0-9]{16,128}$/i.test(token)) notFound();

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("id, name, timezone, settings, public_token")
    .eq("public_token", token)
    .maybeSingle();
  if (!org || org.public_token !== token) notFound();

  const settings = (org.settings ?? {}) as { clock24h?: boolean; safety_schedule_instruction?: string };
  const tz = org.timezone;
  const now = new Date();
  const month = sp.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) ? sp.month : fmtDate(now, tz, "yyyy-MM");
  const [y, m] = month.split("-").map(Number);
  // Fetch a day either side of the month so time zone offsets cannot cut meetings off, then filter by local month.
  const from = new Date(Date.UTC(y, m - 1, 1) - 86400_000).toISOString();
  const to = new Date(Date.UTC(y, m, 1) + 86400_000).toISOString();
  const { data } = await admin
    .from("safety_meetings")
    .select("id, audience, starts_at")
    .eq("organization_id", org.id)
    .eq("status", "scheduled")
    .gte("starts_at", from)
    .lte("starts_at", to)
    .order("starts_at")
    .limit(500);
  const meetings = (data ?? []).filter((x) => fmtDate(x.starts_at, tz, "yyyy-MM") === month);

  const monthTitle = fmtDate(new Date(Date.UTC(y, m - 1, 15, 12)), "UTC", "MMMM yyyy");
  const instruction = settings.safety_schedule_instruction?.trim() || DEFAULT_INSTRUCTION;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-4xl bg-white px-4 py-6 text-black sm:py-10 print:max-w-none print:py-0">
      <header className="border-b-4 border-black pb-6">
        <h1 className="mb-4 text-center text-2xl font-bold sm:text-3xl">SAFETY MEETING SCHEDULES</h1>
        <p className="mb-4 text-center text-xl text-neutral-700">{monthTitle}</p>
        <p className="rounded border-2 border-yellow-400 bg-yellow-200 p-3 text-center font-semibold">{instruction}</p>
      </header>

      <div className="space-y-6 py-6">
        {SECTIONS.map((s) => {
          const rows = meetings.filter((x) => x.audience.length === 0 || x.audience.some((r) => s.roles.includes(r)));
          return (
            <section key={s.label} aria-label={s.label} className="break-inside-avoid overflow-hidden rounded-lg border-2 border-black">
              <h2 className="bg-black px-4 py-3 text-lg font-bold text-yellow-400">{s.label}</h2>
              <div className="space-y-2 p-4">
                {rows.length === 0 ? (
                  <p className="py-4 text-center italic text-neutral-500">No meetings scheduled</p>
                ) : (
                  rows.map((x) => (
                    <p key={x.id} className="rounded bg-neutral-50 px-3 py-2 text-sm sm:text-base">
                      {fmtDate(x.starts_at, tz, "EEEE, MMMM d, yyyy")} - {fmtTime(x.starts_at, tz, settings.clock24h === true)}
                    </p>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
      <p className="text-center text-xs text-neutral-500 print:hidden">{org.name}. Use your browser&apos;s print option to print this page.</p>
    </main>
  );
}
