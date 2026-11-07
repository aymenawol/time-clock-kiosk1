import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { readSettings, type OrgSettings } from "@/lib/settings";
import { serverEnv } from "@/lib/server-env";
import { createAdminClient } from "@/lib/supabase/admin";

export const KIOSK_COOKIE = "rc_kiosk";
const SESSION_TTL_MS = 90_000;
const PAIRING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export interface KioskDevice {
  deviceId: string;
  deviceName: string;
  organizationId: string;
  organizationName: string;
  timeZone: string;
  settings: OrgSettings;
}

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** 8-character pairing code (no 0/O/1/I), shown as XXXX-XXXX. */
export function newPairingCode(): string {
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => PAIRING_ALPHABET[b % PAIRING_ALPHABET.length]).join("");
}

export function normalizePairingCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function newDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

/** The paired device for this browser, or null. */
export async function getKioskDevice(): Promise<KioskDevice | null> {
  const token = (await cookies()).get(KIOSK_COOKIE)?.value;
  if (!token || token.length < 20) return null;
  const { data } = await createAdminClient().rpc("kiosk_device", { p_token_hash: sha256(token) });
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  return {
    deviceId: String(d.device_id),
    deviceName: String(d.device_name),
    organizationId: String(d.organization_id),
    organizationName: String(d.organization_name),
    timeZone: String(d.timezone),
    settings: readSettings(d.settings),
  };
}

function sessionKey(): Buffer {
  const env = serverEnv();
  return createHmac("sha256", env.KIOSK_SESSION_SECRET ?? env.SUPABASE_SECRET_KEY).update("rolecall-kiosk-session-v1").digest();
}

/** Short-lived proof that an employee just entered the right PIN on this device. */
export function signKioskSession(deviceId: string, employeeId: string): string {
  const payload = Buffer.from(JSON.stringify({ d: deviceId, e: employeeId, x: Date.now() + SESSION_TTL_MS })).toString("base64url");
  const sig = createHmac("sha256", sessionKey()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyKioskSession(token: string, deviceId: string): { employeeId: string } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", sessionKey()).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { d: string; e: string; x: number };
    if (data.d !== deviceId || typeof data.e !== "string" || data.x < Date.now()) return null;
    return { employeeId: data.e };
  } catch {
    return null;
  }
}
