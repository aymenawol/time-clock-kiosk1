import "server-only";
import type { OrgSettings } from "@/lib/settings";
import type { createAdminClient } from "@/lib/supabase/admin";
import { evaluateFatigue, type FatigueFinding } from "./fatigue";
import { dailyOvertimeApplies } from "./overtime";
import { SHIFT_WITH_BREAKS, toShiftRecords } from "./records";
import { DAY, type WeekStart } from "./time";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Evaluate fatigue for one employee and store any new findings. Alerts are
 * de-duplicated by (organization, dedupe_key), so running this at every
 * punch is safe. Returns the findings for display (e.g. on the kiosk).
 */
export async function runFatigueCheck(
  admin: Admin,
  opts: { organizationId: string; employeeId: string; timeZone: string; settings: OrgSettings; now?: Date },
): Promise<FatigueFinding[]> {
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - 9 * DAY).toISOString();
  const [{ data: rows }, { data: comp }] = await Promise.all([
    admin
      .from("shifts")
      .select(SHIFT_WITH_BREAKS)
      .eq("employee_id", opts.employeeId)
      .neq("status", "void")
      .gte("clock_in_at", since)
      .order("clock_in_at"),
    admin.from("employee_compensation").select("pay_rate_cents, daily_ot_exempt").eq("employee_id", opts.employeeId).maybeSingle(),
  ]);
  const findings = evaluateFatigue({
    employeeId: opts.employeeId,
    shifts: toShiftRecords(rows ?? []),
    now,
    timeZone: opts.timeZone,
    weekStartsOn: opts.settings.workweekStartsOn as WeekStart,
    dailyOvertime: dailyOvertimeApplies({
      payRateCents: comp?.pay_rate_cents ?? 0,
      minimumWageCents: opts.settings.labor.minimumWageCents,
      exempt: comp?.daily_ot_exempt ?? false,
      orgEnabled: opts.settings.labor.dailyOvertime,
    }),
    rules: opts.settings.fatigue,
  });
  if (findings.length) {
    const { error } = await admin.from("fatigue_alerts").upsert(
      findings.map((f) => ({
        organization_id: opts.organizationId,
        employee_id: opts.employeeId,
        shift_id: f.shiftId,
        kind: f.kind,
        severity: f.severity,
        message: f.message,
        detail: f.detail,
        dedupe_key: f.dedupeKey,
      })),
      { onConflict: "organization_id,dedupe_key", ignoreDuplicates: true },
    );
    if (error) console.error("[fatigue]", error);
  }
  return findings;
}
