/**
 * Proves tenant isolation and role rules in the real database (RLS).
 * Creates two throwaway organizations, signs in as their users with the
 * public key, and checks that nothing crosses the boundary. Cleans up after.
 *
 *   npm run test:rls
 */
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

// Load .env.local when not already in the environment.
try {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  /* CI provides env vars directly */
}

type DB = SupabaseClient<Database>;
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
const SECRET = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!;
const run = randomBytes(4).toString("hex");
const password = `Rls-${randomBytes(12).toString("base64url")}`;

const service: DB = createClient<Database>(URL_, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });

interface Tenant {
  orgId: string;
  admin: { userId: string; employeeId: string; client: DB };
  driver: { userId: string; employeeId: string; client: DB };
  ids: Record<string, string>;
}

const userIds: string[] = [];
const orgIds: string[] = [];

async function signIn(email: string): Promise<DB> {
  const c = createClient<Database>(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

async function person(orgId: string, role: "admin" | "driver", number: string) {
  const email = `rls-${run}-${role}-${orgId.slice(0, 6)}@rls.rolecall.test`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  userIds.push(data.user.id);
  const { data: emp, error: e2 } = await service
    .from("employees")
    .insert({ organization_id: orgId, user_id: data.user.id, employee_number: number, first_name: "Rls", last_name: role, role, email })
    .select("id")
    .single();
  if (e2) throw e2;
  return { userId: data.user.id, employeeId: emp.id, client: await signIn(email) };
}

async function makeTenant(label: string): Promise<Tenant> {
  const { data: org, error } = await service
    .from("organizations")
    .insert({ name: `RLS ${label} ${run}`, slug: `rls-${label}-${run}` })
    .select("id")
    .single();
  if (error) throw error;
  orgIds.push(org.id);
  const admin = await person(org.id, "admin", "9001");
  const driver = await person(org.id, "driver", "9002");
  const one = async <T extends keyof Database["public"]["Tables"]>(table: T, row: Database["public"]["Tables"][T]["Insert"]) => {
    const { data, error: err } = await service.from(table).insert(row as never).select("*").single();
    if (err) throw new Error(`${String(table)}: ${err.message}`);
    return (data as unknown as { id: string }).id;
  };
  const ids: Record<string, string> = {};
  ids.vehicle = await one("vehicles", { organization_id: org.id, number: "1" });
  ids.location = await one("locations", { organization_id: org.id, name: "Stop", code: "S1" });
  ids.shift = await one("shifts", {
    organization_id: org.id,
    employee_id: driver.employeeId,
    work_date: "2026-11-02",
    clock_in_at: "2026-11-02T14:00:00Z",
    clock_out_at: "2026-11-02T22:00:00Z",
    status: "completed",
  });
  ids.form = await one("form_submissions", {
    organization_id: org.id,
    employee_id: driver.employeeId,
    form_type: "resignation",
    payload: { last_day: "2026-12-01" },
  });
  ids.notification = await one("notifications", { organization_id: org.id, employee_id: admin.employeeId, kind: "test", title: "Hello" });
  ids.room = await one("chat_rooms", { organization_id: org.id, name: "Room", kind: "role", roles: ["admin", "driver"] });
  await one("chat_messages", { organization_id: org.id, room_id: ids.room, sender_id: admin.employeeId, body: `secret-${label}` });
  ids.lost = await one("lost_items", { organization_id: org.id, description: "Bag", found_by: driver.employeeId });
  ids.emergency = await one("emergencies", { organization_id: org.id, kind: "custom", title: "Drill", message: "Drill", triggered_by: admin.employeeId });
  ids.fatigue = await one("fatigue_alerts", {
    organization_id: org.id,
    employee_id: driver.employeeId,
    kind: "long_shift",
    message: "Long",
    dedupe_key: `t-${randomUUID()}`,
  });
  ids.period = await one("pay_periods", { organization_id: org.id, starts_on: "2026-11-01", ends_on: "2026-11-14" });
  await one("leave_ledger", { organization_id: org.id, employee_id: driver.employeeId, kind: "pto", hours: 8, reason: "Test" });
  await one("audit_events", { organization_id: org.id, action: "test", entity: "test" } as never);
  await one("kiosk_devices", { organization_id: org.id, name: "Kiosk", token_hash: randomBytes(16).toString("hex") });
  await one("assist_requests", { organization_id: org.id, employee_id: driver.employeeId, passenger_name: "Pat" });
  await one("airlines", { organization_id: org.id, name: "Air" });
  await one("announcements", { organization_id: org.id, message: "Hi" });
  await one("defects", { organization_id: org.id, vehicle_id: ids.vehicle, category: "C", item: "I" });
  return { orgId: org.id, admin, driver, ids };
}

let A: Tenant;
let B: Tenant;

beforeAll(async () => {
  A = await makeTenant("a");
  B = await makeTenant("b");
});

afterAll(async () => {
  for (const id of orgIds) await service.from("organizations").delete().eq("id", id);
  for (const id of userIds) await service.auth.admin.deleteUser(id);
});

const TENANT_TABLES = [
  "organizations",
  "employees",
  "employee_compensation",
  "shifts",
  "breaks",
  "vehicles",
  "locations",
  "notifications",
  "form_submissions",
  "chat_rooms",
  "chat_messages",
  "lost_items",
  "emergencies",
  "kiosk_devices",
  "fatigue_alerts",
  "pay_periods",
  "leave_ledger",
  "audit_events",
  "assist_requests",
  "airlines",
  "announcements",
  "defects",
] as const;

describe("tenant isolation", () => {
  it.each(TENANT_TABLES)("an admin of org A cannot read org B rows in %s", async (table) => {
    const col = table === "organizations" ? "id" : "organization_id";
    const { data, error } = await A.admin.client.from(table).select("*").eq(col as never, B.orgId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("an unfiltered read only returns the caller's organization", async () => {
    const { data } = await A.admin.client.from("employees").select("organization_id");
    expect(data!.length).toBeGreaterThan(0);
    expect(new Set(data!.map((r) => r.organization_id))).toEqual(new Set([A.orgId]));
  });

  it("an admin of org A cannot write into org B", async () => {
    const insert = await A.admin.client.from("vehicles").insert({ organization_id: B.orgId, number: "X" });
    expect(insert.error?.code).toBe("42501");
    const upd = await A.admin.client.from("vehicles").update({ notes: "pwned" }).eq("id", B.ids.vehicle).select();
    expect(upd.data ?? []).toEqual([]);
    const del = await A.admin.client.from("form_submissions").delete().eq("id", B.ids.form).select();
    expect(del.data ?? []).toEqual([]);
    const { data: still } = await service.from("vehicles").select("notes").eq("id", B.ids.vehicle).single();
    expect(still!.notes).toBeNull();
  });

  it("an admin of org A cannot create an employee in org B", async () => {
    const { error } = await A.admin.client
      .from("employees")
      .insert({ organization_id: B.orgId, employee_number: "1234", first_name: "X", last_name: "Y", role: "admin" });
    expect(error?.code).toBe("42501");
  });

  it("an admin of org A cannot run org B's privileged RPCs", async () => {
    const lock = await A.admin.client.rpc("lock_pay_period", { p_period_id: B.ids.period, p_lines: [] });
    expect(lock.error?.message).toMatch(/not found/i);
    const pin = await A.admin.client.rpc("set_employee_pin", { p_employee_id: B.driver.employeeId, p_pin: "4826" });
    expect(pin.error?.message).toMatch(/not found/i);
    const review = await A.admin.client.rpc("review_form", { p_form_id: B.ids.form, p_decision: "approved", p_comment: "" });
    expect(review.error?.message).toMatch(/not found/i);
  });

  it("chat messages never leak across organizations", async () => {
    const { data } = await A.driver.client.from("chat_messages").select("body");
    expect((data ?? []).map((m) => m.body)).not.toContain("secret-b");
    const { data: b } = await A.admin.client.from("chat_messages").select("id").eq("room_id", B.ids.room);
    expect(b).toEqual([]);
  });

  it("realtime-published tables respect RLS for the public key without a session", async () => {
    const anon = createClient<Database>(URL_, ANON, { auth: { persistSession: false } });
    for (const t of ["organizations", "shifts", "vehicles", "emergencies", "airlines", "notifications"] as const) {
      const { data } = await anon.from(t).select("id");
      expect(data ?? []).toEqual([]);
    }
  });
});

describe("role rules inside one organization", () => {
  it("a driver cannot read other people's pay or PINs", async () => {
    const comp = await A.driver.client.from("employee_compensation").select("employee_id");
    expect((comp.data ?? []).map((r) => r.employee_id)).toEqual([A.driver.employeeId]);
    const creds = await A.driver.client.from("employee_credentials").select("*");
    expect(creds.data ?? []).toEqual([]);
    const adminCreds = await A.admin.client.from("employee_credentials").select("*");
    expect(adminCreds.data ?? []).toEqual([]);
  });

  it("a driver cannot change vehicles, shifts or other employees", async () => {
    const v = await A.driver.client.from("vehicles").update({ status: "retired" }).eq("id", A.ids.vehicle).select();
    expect(v.data ?? []).toEqual([]);
    const s = await A.driver.client.from("shifts").update({ clock_out_at: "2026-11-02T23:59:00Z" }).eq("id", A.ids.shift).select();
    expect(s.data ?? []).toEqual([]);
    const e = await A.driver.client.from("employees").update({ role: "admin" }).eq("id", A.driver.employeeId).select();
    expect(e.data ?? []).toEqual([]);
  });

  it("a driver cannot approve their own request", async () => {
    const res = await A.driver.client.rpc("review_form", { p_form_id: A.ids.form, p_decision: "approved", p_comment: "" });
    expect(res.error).not.toBeNull();
    const upd = await A.driver.client.from("form_submissions").update({ status: "approved" }).eq("id", A.ids.form);
    expect(upd.error?.code).toBe("42501");
  });

  it("a driver cannot forge notifications or read other people's", async () => {
    const ins = await A.driver.client
      .from("notifications")
      .insert({ organization_id: A.orgId, employee_id: A.admin.employeeId, kind: "x", title: "fake" });
    expect(ins.error?.code).toBe("42501");
    const { data } = await A.driver.client.from("notifications").select("id").eq("employee_id", A.admin.employeeId);
    expect(data).toEqual([]);
  });

  it("kiosk and maintenance functions are not callable with a user session", async () => {
    const verify = await A.admin.client.rpc("kiosk_verify_pin", {
      p_device_id: randomUUID(),
      p_employee_number: "9002",
      p_pin: "4826",
    });
    expect(verify.error?.code).toBe("42501");
    const device = await A.admin.client.rpc("kiosk_device", { p_token_hash: "x" });
    expect(device.error?.code).toBe("42501");
  });

  it("the public key alone cannot call any RPC", async () => {
    const anon = createClient<Database>(URL_, ANON, { auth: { persistSession: false } });
    const r1 = await anon.rpc("kiosk_device", { p_token_hash: "x" });
    expect(r1.error).not.toBeNull();
    const r2 = await anon.rpc("set_radio_status", { p_code: "10-8" });
    expect(r2.error).not.toBeNull();
  });

  it("the last admin of an organization cannot be demoted", async () => {
    const res = await A.admin.client.from("employees").update({ role: "driver" }).eq("id", A.admin.employeeId);
    expect(res.error?.message).toMatch(/at least one active admin/i);
  });
});
