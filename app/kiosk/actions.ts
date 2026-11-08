"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { breakPolicyFrom, planBreaks } from "@/lib/labor/breaks";
import { runFatigueCheck } from "@/lib/labor/fatigue-runner";
import { localDate } from "@/lib/labor/time";
import { fmtTime } from "@/lib/format";
import {
  getKioskDevice,
  KIOSK_COOKIE,
  newDeviceToken,
  normalizePairingCode,
  sha256,
  signKioskSession,
  verifyKioskSession,
} from "@/lib/kiosk";
import { createAdminClient } from "@/lib/supabase/admin";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export interface KioskBreak {
  id: string;
  kind: "rest" | "meal";
  status: string;
  windowStart: string | null;
  windowEnd: string | null;
  startedAt: string | null;
  plannedMinutes: number;
}

export interface KioskEmployeeState {
  token: string;
  name: string;
  firstName: string;
  clockedIn: boolean;
  clockInAt: string | null;
  onBreak: KioskBreak | null;
  nextBreaks: KioskBreak[];
  actions: ("clock_in" | "clock_out" | "start_rest" | "start_meal" | "end_break")[];
}

export interface PunchOutcome {
  title: string;
  detail: string;
  warnings: string[];
}

const GENERIC_ERROR = "That did not work. Try again or ask a supervisor.";

// ---------------------------------------------------------------------------
// Pairing
// ---------------------------------------------------------------------------
export async function pairKiosk(code: string): Promise<Result<{ name: string }>> {
  const normalized = normalizePairingCode(code ?? "");
  if (normalized.length !== 8) return { ok: false, error: "Enter the 8-character code from Settings > Kiosks." };
  const token = newDeviceToken();
  const { data, error } = await createAdminClient().rpc("kiosk_pair", {
    p_code_hash: sha256(normalized),
    p_token_hash: sha256(token),
  });
  const res = data as { ok?: boolean; name?: string } | null;
  if (error || !res?.ok) return { ok: false, error: "That code is not valid or has expired. Create a new one." };
  (await cookies()).set(KIOSK_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
  return { ok: true, data: { name: res.name ?? "Kiosk" } };
}

// ---------------------------------------------------------------------------
// PIN check: returns the employee's state and the actions they can take now.
// ---------------------------------------------------------------------------
const verifySchema = z.object({
  employeeNumber: z.string().regex(/^\d{3,8}$/),
  pin: z.string().regex(/^\d{4,8}$/),
});

export async function verifyPin(input: { employeeNumber: string; pin: string }): Promise<Result<KioskEmployeeState>> {
  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Employee number or PIN is incorrect." };
  const device = await getKioskDevice();
  if (!device) return { ok: false, error: "This kiosk is no longer paired. Ask an admin to pair it again." };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("kiosk_verify_pin", {
    p_device_id: device.deviceId,
    p_employee_number: parsed.data.employeeNumber,
    p_pin: parsed.data.pin,
  });
  if (error) {
    console.error("[kiosk] verify", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  const res = data as { result: string; employee_id?: string; locked_until?: string };
  if (res.result === "locked") {
    const until = res.locked_until ? fmtTime(res.locked_until, device.timeZone, device.settings.clock24h) : "later";
    return { ok: false, error: `Too many wrong PINs. Try again after ${until}, or ask a supervisor.` };
  }
  if (res.result === "device_locked") return { ok: false, error: "This kiosk is paused after many wrong PINs. Try again in a few minutes." };
  if (res.result === "device_revoked") return { ok: false, error: "This kiosk is no longer paired. Ask an admin to pair it again." };
  if (res.result !== "ok" || !res.employee_id) return { ok: false, error: "Employee number or PIN is incorrect." };

  return { ok: true, data: await loadState(device.deviceId, res.employee_id) };
}

async function loadState(deviceId: string, employeeId: string): Promise<KioskEmployeeState> {
  const admin = createAdminClient();
  const [{ data: emp }, { data: shift }] = await Promise.all([
    admin.from("employees").select("first_name, last_name, status").eq("id", employeeId).single(),
    admin
      .from("shifts")
      .select("id, clock_in_at, breaks(id, kind, status, window_start, window_end, started_at, ended_at, planned_minutes)")
      .eq("employee_id", employeeId)
      .eq("status", "active")
      .maybeSingle(),
  ]);
  const rows = [...(shift?.breaks ?? [])].sort((a, b) => (a.window_start ?? "").localeCompare(b.window_start ?? ""));
  const toBreak = (b: (typeof rows)[number]): KioskBreak => ({
    id: b.id,
    kind: b.kind,
    status: b.status,
    windowStart: b.window_start,
    windowEnd: b.window_end,
    startedAt: b.started_at,
    plannedMinutes: b.planned_minutes,
  });
  const open = rows.find((b) => b.started_at && !b.ended_at);
  const onBreak = open ? toBreak(open) : null;
  const nextBreaks = rows.filter((b) => !b.started_at && (b.status === "planned" || b.status === "missed")).map(toBreak);

  const actions: KioskEmployeeState["actions"] = [];
  if (!shift) actions.push("clock_in");
  else if (onBreak) actions.push("end_break");
  else actions.push("start_rest", "start_meal", "clock_out");

  return {
    token: signKioskSession(deviceId, employeeId),
    name: `${emp?.first_name ?? ""} ${emp?.last_name ?? ""}`.trim(),
    firstName: emp?.first_name ?? "",
    clockedIn: Boolean(shift),
    clockInAt: shift?.clock_in_at ?? null,
    onBreak,
    nextBreaks,
    actions,
  };
}

// ---------------------------------------------------------------------------
// Punches
// ---------------------------------------------------------------------------
const punchSchema = z.object({
  token: z.string().min(20).max(500),
  action: z.enum(["clock_in", "clock_out", "start_rest", "start_meal", "end_break"]),
});

export async function punch(input: { token: string; action: KioskEmployeeState["actions"][number] }): Promise<Result<PunchOutcome>> {
  const parsed = punchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR };
  const device = await getKioskDevice();
  if (!device) return { ok: false, error: "This kiosk is no longer paired." };
  const session = verifyKioskSession(parsed.data.token, device.deviceId);
  if (!session) return { ok: false, error: "That took too long. Enter your PIN again." };

  const admin = createAdminClient();
  const { employeeId } = session;
  const { timeZone, settings } = device;
  const t = (d: string | Date) => fmtTime(d, timeZone, settings.clock24h);
  const warnings: string[] = [];

  try {
    switch (parsed.data.action) {
      case "clock_in": {
        const now = new Date();
        const plan = planBreaks(now, settings.breaks.defaultShiftMinutes, breakPolicyFrom(settings.breaks));
        const { data: shift, error } = await admin.rpc("kiosk_clock_in", {
          p_device_id: device.deviceId,
          p_employee_id: employeeId,
          p_work_date: localDate(now, timeZone),
          p_breaks: plan.map((b) => ({
            kind: b.kind,
            paid: b.paid,
            sequence: b.sequence,
            planned_minutes: b.plannedMinutes,
            window_start: b.windowStart.toISOString(),
            window_end: b.windowEnd.toISOString(),
          })),
        });
        if (error) throw error;
        const findings = await runFatigueCheck(admin, { organizationId: device.organizationId, employeeId, timeZone, settings });
        warnings.push(...findings.map((f) => f.message));
        const first = plan[0];
        return {
          ok: true,
          data: {
            title: `Clocked in at ${t(shift.clock_in_at)}`,
            detail: first
              ? `First break (${first.kind}) between ${t(first.windowStart)} and ${t(first.windowEnd)}.`
              : "Have a safe shift.",
            warnings,
          },
        };
      }
      case "clock_out": {
        const { data: shift, error } = await admin.rpc("kiosk_clock_out", { p_device_id: device.deviceId, p_employee_id: employeeId });
        if (error) throw error;
        const findings = await runFatigueCheck(admin, { organizationId: device.organizationId, employeeId, timeZone, settings });
        warnings.push(...findings.filter((f) => f.kind !== "short_rest").map((f) => f.message));
        const minutes = Math.round((new Date(shift.clock_out_at!).getTime() - new Date(shift.clock_in_at).getTime()) / 60000);
        return {
          ok: true,
          data: {
            title: `Clocked out at ${t(shift.clock_out_at!)}`,
            detail: `On the clock for ${Math.floor(minutes / 60)} h ${minutes % 60} min. Get some rest.`,
            warnings,
          },
        };
      }
      case "start_rest":
      case "start_meal": {
        const kind = parsed.data.action === "start_rest" ? "rest" : "meal";
        const { data: b, error } = await admin.rpc("kiosk_start_break", {
          p_device_id: device.deviceId,
          p_employee_id: employeeId,
          p_kind: kind,
        });
        if (error) throw error;
        const back = new Date(new Date(b.started_at!).getTime() + b.planned_minutes * 60000);
        return {
          ok: true,
          data: {
            title: `${kind === "rest" ? "Rest" : "Meal"} break started`,
            detail: `${b.planned_minutes} minutes${b.paid ? " (paid)" : " (unpaid)"}. Please end it by ${t(back)}.`,
            warnings,
          },
        };
      }
      case "end_break": {
        const { data: b, error } = await admin.rpc("kiosk_end_break", { p_device_id: device.deviceId, p_employee_id: employeeId });
        if (error) throw error;
        const minutes = Math.round((new Date(b.ended_at!).getTime() - new Date(b.started_at!).getTime()) / 60000);
        return { ok: true, data: { title: "Welcome back", detail: `Your ${b.kind} break lasted ${minutes} min.`, warnings } };
      }
    }
  } catch (err) {
    const e = err as { code?: string; message?: string };
    if (e.code === "P0001" && e.message) return { ok: false, error: e.message };
    console.error("[kiosk] punch", err);
    return { ok: false, error: GENERIC_ERROR };
  }
}
